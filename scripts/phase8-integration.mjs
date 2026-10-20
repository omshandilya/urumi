/**
 * Destructive-but-reversible integration check for a running local deployment.
 * It creates a fresh member/key and restores the shipping and calculator servers.
 * Usage (PowerShell): $env:ADMIN_KEY='uk_...'; npm run test:integration
 */
const base = (process.env.GATEWAY_URL ?? "http://gateway.localhost").replace(/\/$/, "");
const adminKey = process.env.ADMIN_KEY;
if (!adminKey) throw new Error("Set ADMIN_KEY to the bootstrap admin gateway key.");
const unique = `phase8-${Date.now()}@example.test`;
const headers = (key, json = false) => ({ authorization: `Bearer ${key}`, ...(json ? { "content-type": "application/json" } : {}) });
const api = async (method, path, key, body) => {
  const response = await fetch(`${base}${path}`, { method, headers: headers(key, body !== undefined), body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${payload?.error ?? ""}`);
  return payload;
};
const mcp = async (key, method, params = {}) => {
  const response = await fetch(`${base}/mcp`, { method: "POST", headers: { ...headers(key, true), accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
  if (!response.ok) return { status: response.status, payload: await response.json().catch(() => null) };
  const text = await response.text();
  const json = JSON.parse(text.replace(/^event: message\s*\ndata: /, "").trim());
  return { status: response.status, payload: json };
};
const assert = (condition, message) => { if (!condition) throw new Error(`Assertion failed: ${message}`); };

let memberKey;
let shipping;
try {
  console.log("Creating isolated member and API key…");
  await api("POST", "/api/members", adminKey, { email: unique, role: "member" });
  const members = await api("GET", "/api/members", adminKey);
  const member = members.find((item) => item.email === unique);
  memberKey = (await api("POST", "/api/keys", adminKey, { label: "phase-8-test", user_id: member.id })).token;

  const listed = await mcp(memberKey, "tools/list");
  assert(listed.status === 200, "member can list gateway tools");
  const names = listed.payload.result.tools.map((tool) => tool.name);
  for (const name of ["woocommerce__list_orders", "shipping__lookup_shipping_zone", "calculator__calculate_total", "shipping__server_status", "calculator__server_status"]) assert(names.includes(name), `${name} is visible`);

  const calculation = await mcp(memberKey, "tools/call", { name: "calculator__calculate_total", arguments: { amount: 100, tax_percent: 18 } });
  assert(calculation.status === 200 && !calculation.payload.result.isError, "member can call an upstream tool");

  console.log("Checking disabled-server removal…");
  await api("POST", "/api/servers/calculator/disable", adminKey, {});
  const withoutCalculator = await mcp(adminKey, "tools/list");
  assert(!withoutCalculator.payload.result.tools.some((tool) => tool.name.startsWith("calculator__")), "disabled tools disappear");
  await api("PATCH", "/api/servers/calculator", adminKey, { enabled: true });

  console.log("Checking a dead upstream is isolated…");
  shipping = (await api("GET", "/api/servers", adminKey)).find((server) => server.slug === "shipping");
  await api("PATCH", "/api/servers/shipping", adminKey, { url: "http://127.0.0.1:1/mcp", timeout_ms: 1000 });
  const degraded = await mcp(adminKey, "tools/list");
  const degradedNames = degraded.payload.result.tools.map((tool) => tool.name);
  assert(!degradedNames.some((name) => name.startsWith("shipping__")) && degradedNames.includes("calculator__calculate_total"), "dead upstream does not break healthy upstreams");
  await api("PATCH", "/api/servers/shipping", adminKey, { url: shipping.url, timeout_ms: shipping.timeout_ms });

  const audit = await api("GET", "/api/audit-logs", adminKey);
  assert(audit.some((entry) => entry.email === unique && entry.tool_name === "calculate_total" && entry.outcome === "success"), "audit log attributes the member tool call");

  console.log("Checking key revocation…");
  const keys = await api("GET", "/api/keys", adminKey);
  const issued = keys.find((item) => item.email === unique && item.label === "phase-8-test");
  await api("DELETE", `/api/keys/${issued.id}`, adminKey);
  const revoked = await mcp(memberKey, "tools/list");
  assert(revoked.status === 401, "revoked key is rejected");
  console.log("Phase 8 integration checks passed.");
} finally {
  if (shipping) await api("PATCH", "/api/servers/shipping", adminKey, { url: shipping.url, timeout_ms: shipping.timeout_ms }).catch(() => {});
  await api("PATCH", "/api/servers/calculator", adminKey, { enabled: true }).catch(() => {});
}
