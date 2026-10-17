export type WooConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
};

export class WooCommerceClient {
  constructor(private readonly config: WooConfig) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const authorization = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`,
    ).toString("base64");
    const response = await fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/wp-json/wc/v3${path}`,
      {
        ...init,
        headers: {
          Authorization: `Basic ${authorization}`,
          Accept: "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new Error(`WooCommerce returned ${response.status}: ${await response.text()}`);
    }
    return response.json() as Promise<T>;
  }

  listProducts(search?: string) {
    const query = new URLSearchParams({ per_page: "20" });
    if (search) query.set("search", search);
    return this.request<unknown[]>(`/products?${query}`);
  }

  createProduct(name: string, regularPrice: string, description?: string) {
    return this.request<unknown>("/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, regular_price: regularPrice, description, type: "simple" }),
    });
  }

  listOrders(after?: string) {
    const query = new URLSearchParams({ per_page: "20", orderby: "date", order: "desc" });
    if (after) query.set("after", after);
    return this.request<unknown[]>(`/orders?${query}`);
  }

  getOrder(orderId: number) {
    return this.request<unknown>(`/orders/${orderId}`);
  }

  updateOrderStatus(orderId: number, status: string) {
    return this.request<unknown>(`/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }
}
