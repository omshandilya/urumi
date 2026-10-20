import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const mode = process.env.MODE ?? "catalog";
const app = express();
app.use(express.json());
app.get("/healthz", (_req, res) => res.json({ status: "ok", mode }));
app.post("/mcp", async (req, res) => {
  const server = new McpServer({ name: `urumi-${mode}`, version: "0.1.0" });
  if (mode === "catalog") {
    server.tool("lookup_shipping_zone", "Look up a demo shipping zone and fee for an Indian postal code.", { postal_code: z.string().min(4) }, async ({ postal_code }) => ({ content: [{ type: "text", text: JSON.stringify({ postal_code, zone: postal_code.startsWith("56") ? "South" : "Standard", shipping_fee_inr: postal_code.startsWith("56") ? 80 : 120 }) }] }));
    server.tool("server_status", "Return the shipping reference server status.", {}, async () => ({ content: [{ type: "text", text: JSON.stringify({ server: "shipping", status: "ready" }) }] }));
  } else {
    server.tool("calculate_total", "Calculate an amount plus a percentage tax.", { amount: z.number().nonnegative(), tax_percent: z.number().min(0).max(100).default(18) }, async ({ amount, tax_percent }) => ({ content: [{ type: "text", text: JSON.stringify({ amount, tax_percent, total: Number((amount * (1 + tax_percent / 100)).toFixed(2)) }) }] }));
    server.tool("server_status", "Return the tax calculator server status.", {}, async () => ({ content: [{ type: "text", text: JSON.stringify({ server: "calculator", status: "ready" }) }] }));
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => void transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
app.listen(3000, "0.0.0.0", () => console.log(`${mode} MCP listening`));
