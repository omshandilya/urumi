import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { WooCommerceClient } from "./woocommerce.js";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
};

const woo = new WooCommerceClient({
  baseUrl: required("WOOCOMMERCE_URL"),
  consumerKey: required("WOOCOMMERCE_CONSUMER_KEY"),
  consumerSecret: required("WOOCOMMERCE_CONSUMER_SECRET"),
});
const staticToken = required("MCP_SHARED_TOKEN");

function result(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function buildServer() {
  const server = new McpServer({ name: "urumi-woocommerce", version: "0.1.0" });
  server.tool("list_products", "List up to 20 WooCommerce products.", { search: z.string().optional() }, async ({ search }) => result(await woo.listProducts(search)));
  server.tool("create_product", "Create a simple WooCommerce product.", { name: z.string().min(1), regular_price: z.string().regex(/^\d+(\.\d{1,2})?$/), description: z.string().optional() }, async ({ name, regular_price, description }) => result(await woo.createProduct(name, regular_price, description)));
  server.tool("list_orders", "List up to 20 orders, newest first. Pass an ISO timestamp to filter orders created after it.", { after: z.string().datetime().optional() }, async ({ after }) => result(await woo.listOrders(after)));
  server.tool("get_order", "Retrieve one WooCommerce order by numeric ID.", { order_id: z.number().int().positive() }, async ({ order_id }) => result(await woo.getOrder(order_id)));
  server.tool("update_order_status", "Update an order status.", { order_id: z.number().int().positive(), status: z.enum(["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed", "trash"]) }, async ({ order_id, status }) => result(await woo.updateOrderStatus(order_id, status)));
  return server;
}

const app = express();
app.use(express.json());
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
app.post("/mcp", async (req: Request, res: Response) => {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (token !== staticToken) return res.status(401).json({ error: "unauthorized" });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => void transport.close());
  await buildServer().connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0", () => console.log("WooCommerce MCP server listening"));
