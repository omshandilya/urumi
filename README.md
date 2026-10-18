# Urumi MCP Gateway on Kubernetes

This repository currently implements Phases 1–6: a local Kind cluster, persistent WooCommerce store, custom Streamable HTTP WooCommerce MCP server, a team gateway, and an admin/member React dashboard. The chat agent is Phase 7 work.

## Prerequisites

Install and start Docker Desktop in **Linux containers** mode. Install Kind; `kubectl`, Helm, Node.js 22+, npm, and Git are already required.

```powershell
winget install Kubernetes.kind
docker desktop start
kind create cluster --name urumi --config .\config\kind-local.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=Ready pod --selector=app.kubernetes.io/component=controller --timeout=180s
```

`store.localhost` resolves to `127.0.0.1` on modern Windows. `config/kind-local.yaml` maps host ports 80/443 into Kind so the ingress controller can route it to the store; no hosts-file edit is needed.

If you created the cluster before this configuration was added, recreate the local Kind cluster with the command above. This removes only the local cluster and its local persistent volumes.

## Build and deploy

Install the MCP service dependencies and build its image:

```powershell
npm install
docker build -t urumi/woocommerce-mcp:dev .\apps\woocommerce-mcp
kind load docker-image urumi/woocommerce-mcp:dev --name urumi
Copy-Item .\config\values-secrets.example.yaml .\config\values-secrets.local.yaml
```

Edit `config/values-secrets.local.yaml`. Generate values locally; do not commit that file:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
node -e "console.log('ck_'+require('crypto').randomBytes(24).toString('hex'))"
node -e "console.log('cs_'+require('crypto').randomBytes(24).toString('hex'))"
```

Then deploy:

```powershell
helm upgrade --install urumi .\charts\urumi-platform -f .\charts\urumi-platform\values-local.yaml -f .\config\values-secrets.local.yaml
kubectl get pods -n urumi -w
```

Visit [http://store.localhost](http://store.localhost), sign in at `/wp-admin` with the configured admin credentials, and create a product or use the storefront checkout. The bootstrap Job installs and activates WooCommerce and creates the REST key supplied in your private values file.

The custom MCP endpoint is internal only: `http://urumi-woocommerce-mcp.urumi.svc.cluster.local:3000/mcp`. It requires `Authorization: Bearer <mcpSharedToken>`. Phase 4 will make this reachable only through the gateway—not from an external MCP client.

## Gateway (Phases 4–5)

The only public MCP endpoint is [http://gateway.localhost/mcp](http://gateway.localhost/mcp). Authenticate with `Authorization: Bearer <gateway API key>` and accept both `application/json` and `text/event-stream`.

The gateway registers three upstream servers: WooCommerce, shipping reference, and tax calculator. Tool names are collision-safe: `<server-slug>__<tool-name>`, for example `woocommerce__list_orders` and `calculator__calculate_total`. Upstream URLs and their credentials remain server-side; the management API never returns credentials.

Get the bootstrap admin key locally (do not share or commit it):

```powershell
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String((kubectl get secret urumi-credentials -n urumi -o jsonpath='{.data.gateway-admin-key}')))
```

Use it to call the protected management API at `http://gateway.localhost/api/`. Admin-only endpoints are `GET/POST/PATCH/DELETE /api/servers`, `POST /api/servers/:slug/disable`, `GET/POST /api/members`, and `GET /api/audit-logs`. Every user can list/create their own keys at `GET/POST /api/keys`; admins can create or revoke any member's key. `DELETE /api/keys/:id` revokes a key immediately.

For a quick API-key creation example, replace `ADMIN_KEY` locally:

```powershell
Invoke-RestMethod -Method Post -Uri http://gateway.localhost/api/keys -Headers @{ Authorization = "Bearer ADMIN_KEY"; 'Content-Type' = 'application/json' } -Body '{"label":"my-external-client-key"}'
```

## Dashboard (Phase 6)

Open [http://dashboard.localhost](http://dashboard.localhost) and paste an individual gateway API key. The key stays in browser session storage only. Admins can manage upstreams, members, every key, and audit logs. Members can view enabled upstreams/tools and issue or revoke their own keys.

## Validation

```powershell
helm lint .\charts\urumi-platform
npm run build
kubectl get pvc,pods,jobs -n urumi
kubectl logs job/urumi-wordpress-bootstrap -n urumi
```

## Production configuration

Use the same chart with `values-prod.yaml`, a production image registry, production ingress domain, appropriate storage class, and an externally managed secret file or secret manager. See the assignment brief for Phase 9 requirements.
