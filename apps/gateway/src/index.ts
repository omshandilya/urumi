import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import mysql from "mysql2/promise";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const env = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; };
const database = mysql.createPool({ host: env("DB_HOST"), user: env("DB_USER"), password: env("DB_PASSWORD"), database: env("DB_NAME"), waitForConnections: true, connectionLimit: 8 });
const hashKey = (key: string) => crypto.createHash("sha256").update(`${env("KEY_PEPPER")}:${key}`).digest("hex");
const encryptionKey = Buffer.from(env("CREDENTIAL_ENCRYPTION_KEY"), "base64");
if (encryptionKey.length !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must be base64 encoded 32 bytes");
const encrypt = (value: string) => { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv); const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64"); };
const decrypt = (value: string | null) => { if (!value) return undefined; const bytes = Buffer.from(value, "base64"); const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"); };

type User = { id: string; email: string; role: "admin" | "member" };
type Upstream = { id: string; slug: string; name: string; url: string; credential: string | null; enabled: number; status: string; timeout_ms: number };
const id = () => crypto.randomUUID();

async function migrate() {
  await database.query(`CREATE TABLE IF NOT EXISTS gateway_users (id CHAR(36) PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, role ENUM('admin','member') NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await database.query(`CREATE TABLE IF NOT EXISTS gateway_api_keys (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, label VARCHAR(100) NOT NULL, key_hash CHAR(64) NOT NULL UNIQUE, revoked_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES gateway_users(id) ON DELETE CASCADE)`);
  await database.query(`CREATE TABLE IF NOT EXISTS gateway_upstreams (id CHAR(36) PRIMARY KEY, slug VARCHAR(64) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL, url VARCHAR(512) NOT NULL, credential_encrypted TEXT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, status VARCHAR(20) NOT NULL DEFAULT 'Unknown', timeout_ms INT NOT NULL DEFAULT 10000, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await database.query(`CREATE TABLE IF NOT EXISTS gateway_audit_logs (id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, server_slug VARCHAR(64) NOT NULL, tool_name VARCHAR(128) NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, duration_ms INT NOT NULL, outcome VARCHAR(20) NOT NULL, detail TEXT NULL, FOREIGN KEY (user_id) REFERENCES gateway_users(id))`);
  const adminId = id();
  await database.query("INSERT IGNORE INTO gateway_users (id,email,role) VALUES (?,?, 'admin')", [adminId, env("BOOTSTRAP_ADMIN_EMAIL")]);
  const [admins] = await database.query<mysql.RowDataPacket[]>("SELECT id FROM gateway_users WHERE email=?", [env("BOOTSTRAP_ADMIN_EMAIL")]);
  await database.query("INSERT IGNORE INTO gateway_api_keys (id,user_id,label,key_hash) VALUES (?,?,?,?)", [id(), admins[0].id, "bootstrap admin", hashKey(env("BOOTSTRAP_ADMIN_KEY"))]);
  const seeded = [
    ["woocommerce", "WooCommerce", env("WOOCOMMERCE_MCP_URL"), encrypt(`Bearer ${env("WOOCOMMERCE_MCP_TOKEN")}`)],
    ["shipping", "Shipping reference", env("SHIPPING_MCP_URL"), null],
    ["calculator", "Tax calculator", env("CALCULATOR_MCP_URL"), null],
  ];
  for (const row of seeded) await database.query("INSERT IGNORE INTO gateway_upstreams (id,slug,name,url,credential_encrypted) VALUES (?,?,?,?,?)", [id(), ...row]);
}

async function authenticate(req: Request): Promise<User | null> {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [rows] = await database.query<mysql.RowDataPacket[]>(`SELECT u.id,u.email,u.role FROM gateway_api_keys k JOIN gateway_users u ON u.id=k.user_id WHERE k.key_hash=? AND k.revoked_at IS NULL`, [hashKey(token)]);
  return rows[0] as User | undefined ?? null;
}
const secure = (admin = false) => async (req: Request, res: Response, next: NextFunction) => { const user = await authenticate(req); if (!user) return res.status(401).json({ error: "invalid or revoked API key" }); if (admin && user.role !== "admin") return res.status(403).json({ error: "admin role required" }); (req as Request & { user: User }).user = user; next(); };

async function rows() { const [result] = await database.query<mysql.RowDataPacket[]>("SELECT id,slug,name,url,credential_encrypted AS credential,enabled,status,timeout_ms FROM gateway_upstreams"); return result as Upstream[]; }
async function connected(upstream: Upstream) {
  const headers: Record<string, string> = {}; const credential = decrypt(upstream.credential); if (credential) headers.Authorization = credential;
  const transport = new StreamableHTTPClientTransport(new URL(upstream.url), { requestInit: { headers } });
  const client = new Client({ name: "urumi-gateway", version: "0.1.0" });
  try { await Promise.race([client.connect(transport), new Promise((_, reject) => setTimeout(() => reject(new Error("upstream connection timed out")), upstream.timeout_ms))]); return { client, transport }; }
  catch (error) { await transport.close().catch(() => undefined); throw error; }
}
async function tools() {
  const active = (await rows()).filter((server) => server.enabled);
  const settled = await Promise.allSettled(active.map(async (server) => { const { client, transport } = await connected(server); try { const response = await client.listTools(); await database.query("UPDATE gateway_upstreams SET status='Connected' WHERE id=?", [server.id]); return response.tools.map((tool) => ({ ...tool, name: `${server.slug}__${tool.name}`, description: `[${server.name}] ${tool.description ?? ""}` })); } finally { await transport.close(); } }));
  return settled.flatMap((result, index) => { if (result.status === "fulfilled") return result.value; void database.query("UPDATE gateway_upstreams SET status='Unreachable' WHERE id=?", [active[index].id]); return []; });
}
async function call(user: User, fullName: string, args: unknown) {
  const separator = fullName.indexOf("__"); if (separator < 1) throw new Error("Tool name must use server__tool format");
  const slug = fullName.slice(0, separator), tool = fullName.slice(separator + 2);
  const upstream = (await rows()).find((server) => server.slug === slug && server.enabled);
  if (!upstream) throw new Error(`Enabled upstream '${slug}' was not found`);
  const started = Date.now();
  try { const { client, transport } = await connected(upstream); try { const value = await Promise.race([client.callTool({ name: tool, arguments: args as Record<string, unknown> }), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("upstream tool call timed out")), upstream.timeout_ms))]); await database.query("INSERT INTO gateway_audit_logs (id,user_id,server_slug,tool_name,duration_ms,outcome) VALUES (?,?,?,?,?, 'success')", [id(), user.id, slug, tool, Date.now() - started]); return value; } finally { await transport.close(); } }
  catch (error) { await database.query("INSERT INTO gateway_audit_logs (id,user_id,server_slug,tool_name,duration_ms,outcome,detail) VALUES (?,?,?,?,?,'error',?)", [id(), user.id, slug, tool, Date.now() - started, error instanceof Error ? error.message : "unknown error"]); throw error; }
}

const app = express(); app.use(express.json());
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/api/me", secure(), (req, res) => res.json((req as Request & { user: User }).user));
app.get("/api/servers", secure(), async (_req, res) => res.json((await rows()).map(({ credential: _credential, ...server }) => server)));
const serverInput = z.object({ slug: z.string().regex(/^[a-z][a-z0-9-]{1,62}$/), name: z.string().min(1), url: z.string().url(), credential: z.string().optional(), enabled: z.boolean().optional(), timeout_ms: z.number().int().min(1000).max(60000).optional() });
app.post("/api/servers", secure(true), async (req, res) => { const body = serverInput.parse(req.body); await database.query("INSERT INTO gateway_upstreams (id,slug,name,url,credential_encrypted,timeout_ms) VALUES (?,?,?,?,?,?)", [id(), body.slug, body.name, body.url, body.credential ? encrypt(body.credential) : null, body.timeout_ms ?? 10000]); res.status(201).json({ status: "created" }); });
app.patch("/api/servers/:slug", secure(true), async (req, res) => { const body = serverInput.partial().parse(req.body); const values: unknown[] = []; const set: string[] = []; for (const [key, value] of Object.entries(body)) { set.push(`${key === "credential" ? "credential_encrypted" : key}=?`); values.push(key === "credential" && value ? encrypt(String(value)) : value); } if (set.length) await database.query(`UPDATE gateway_upstreams SET ${set.join(",")} WHERE slug=?`, [...values, req.params.slug]); res.json({ status: "updated" }); });
app.post("/api/servers/:slug/disable", secure(true), async (req, res) => { await database.query("UPDATE gateway_upstreams SET enabled=FALSE,status='Disabled' WHERE slug=?", [req.params.slug]); res.json({ status: "disabled" }); });
app.delete("/api/servers/:slug", secure(true), async (req, res) => { await database.query("DELETE FROM gateway_upstreams WHERE slug=?", [req.params.slug]); res.status(204).end(); });
app.get("/api/members", secure(true), async (_req, res) => { const [result] = await database.query("SELECT id,email,role,created_at FROM gateway_users"); res.json(result); });
app.post("/api/members", secure(true), async (req, res) => { const body = z.object({ email: z.string().email(), role: z.enum(["admin", "member"]) }).parse(req.body); await database.query("INSERT INTO gateway_users (id,email,role) VALUES (?,?,?)", [id(), body.email, body.role]); res.status(201).json({ status: "created" }); });
app.post("/api/keys", secure(), async (req, res) => { const requester = (req as Request & { user: User }).user; const body = z.object({ label: z.string().min(1).max(100), user_id: z.string().uuid().optional() }).parse(req.body); const target = body.user_id ?? requester.id; if (target !== requester.id && requester.role !== "admin") return res.status(403).json({ error: "cannot create another user's key" }); const token = `uk_${crypto.randomBytes(32).toString("base64url")}`; const keyId = id(); await database.query("INSERT INTO gateway_api_keys (id,user_id,label,key_hash) VALUES (?,?,?,?)", [keyId, target, body.label, hashKey(token)]); res.status(201).json({ id: keyId, token, warning: "Copy this API key now; it is never stored in plaintext." }); });
app.get("/api/keys", secure(), async (req, res) => { const requester = (req as Request & { user: User }).user; const [result] = await database.query(requester.role === "admin" ? "SELECT k.id,u.email,k.label,k.revoked_at,k.created_at FROM gateway_api_keys k JOIN gateway_users u ON u.id=k.user_id ORDER BY k.created_at DESC" : "SELECT k.id,u.email,k.label,k.revoked_at,k.created_at FROM gateway_api_keys k JOIN gateway_users u ON u.id=k.user_id WHERE k.user_id=? ORDER BY k.created_at DESC", requester.role === "admin" ? [] : [requester.id]); res.json(result); });
app.delete("/api/keys/:id", secure(), async (req, res) => { const requester = (req as Request & { user: User }).user; const [keys] = await database.query<mysql.RowDataPacket[]>("SELECT user_id FROM gateway_api_keys WHERE id=?", [req.params.id]); if (!keys[0]) return res.status(404).end(); if (keys[0].user_id !== requester.id && requester.role !== "admin") return res.status(403).end(); await database.query("UPDATE gateway_api_keys SET revoked_at=NOW() WHERE id=?", [req.params.id]); res.status(204).end(); });
app.get("/api/audit-logs", secure(true), async (_req, res) => { const [result] = await database.query("SELECT l.id,u.email,l.server_slug,l.tool_name,l.timestamp,l.duration_ms,l.outcome,l.detail FROM gateway_audit_logs l JOIN gateway_users u ON u.id=l.user_id ORDER BY l.timestamp DESC LIMIT 200"); res.json(result); });
app.post("/mcp", async (req, res) => { const user = await authenticate(req); if (!user) return res.status(401).json({ error: "invalid or revoked API key" }); const server = new Server({ name: "urumi-gateway", version: "0.1.0" }, { capabilities: { tools: {} } }); server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: await tools() })); server.setRequestHandler(CallToolRequestSchema, async (request) => { try { return await call(user, request.params.name, request.params.arguments ?? {}); } catch (error) { return { content: [{ type: "text", text: error instanceof Error ? error.message : "Tool call failed" }], isError: true }; } }); const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); res.on("close", () => void transport.close()); await server.connect(transport); await transport.handleRequest(req, res, req.body); });

migrate().then(() => app.listen(3000, "0.0.0.0", () => console.log("Urumi gateway listening on :3000"))).catch((error) => { console.error(error); process.exit(1); });
