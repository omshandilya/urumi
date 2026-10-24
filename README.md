# Urumi MCP Gateway on Kubernetes

This repository implements Phases 1–10: a local Kind cluster, persistent WooCommerce store, custom Streamable HTTP WooCommerce MCP server, a team gateway, an admin/member React dashboard, a tool-using chat agent, end-to-end access/failure checks, and production deployment/submission material.

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

Install dependencies and build the four application images:

```powershell
npm install
docker build -t urumi/woocommerce-mcp:dev .\apps\woocommerce-mcp
docker build -t urumi/gateway:dev .\apps\gateway
docker build -t urumi/sample-mcp:dev .\apps\sample-mcp
docker build -t urumi/dashboard:dev .\apps\dashboard
kind load docker-image urumi/woocommerce-mcp:dev --name urumi
kind load docker-image urumi/gateway:dev --name urumi
kind load docker-image urumi/sample-mcp:dev --name urumi
kind load docker-image urumi/dashboard:dev --name urumi
Copy-Item .\config\values-secrets.example.yaml .\config\values-secrets.local.yaml
```

Edit `config/values-secrets.local.yaml`. Generate values locally; do not commit that file:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
node -e "console.log('ck_'+require('crypto').randomBytes(24).toString('hex'))"
node -e "console.log('cs_'+require('crypto').randomBytes(24).toString('hex'))"
```

For Phase 7, configure an OpenAI-compatible chat provider in that private file and a second private values file such as `config/values-llm.local.yaml`:

```yaml
secrets:
  llmApiKey: "your-provider-key"
llm:
  baseUrl: "https://openrouter.ai/api/v1"
  model: "your-tool-capable-model"
```

The model key is mounted only in the gateway pod. The browser receives neither that key nor any upstream credential.

Then deploy:

```powershell
helm upgrade --install urumi .\charts\urumi-platform -f .\charts\urumi-platform\values-local.yaml -f .\config\values-llm.local.yaml -f .\config\values-secrets.local.yaml
kubectl get pods -n urumi -w
```

Visit [http://store.localhost](http://store.localhost), sign in at `/wp-admin` with the configured admin credentials, and create a product or use the storefront checkout. The bootstrap Job installs and activates WooCommerce and creates the REST key supplied in your private values file.

The custom MCP endpoint is internal only: `http://urumi-woocommerce-mcp.urumi.svc.cluster.local:3000/mcp`. It requires `Authorization: Bearer <mcpSharedToken>` and is reachable only from the gateway—not from an external MCP client.

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

## Chat agent and external clients (Phase 7)

The **Chat** tab sends a message to `POST /api/chat`. The gateway fetches its current enabled tool schemas, sends only those schemas to the configured LLM, and executes requested tools through its own router as the logged-in user. The chat UI shows each call, and the audit log records the same call under that user.

Connect an external MCP client to `http://gateway.localhost/mcp` with the user's individual API key in the `Authorization: Bearer ...` header. It needs no WooCommerce, shipping, calculator, or LLM credential. Tool names are `<server-slug>__<tool-name>`; this also prevents collisions. For example, both sample servers intentionally expose `server_status`, which appears as `shipping__server_status` and `calculator__server_status`.

## Phase 8 integration checks

With the release running, fetch the bootstrap admin key as shown above and run:

```powershell
$env:ADMIN_KEY = "uk_your_bootstrap_key"
npm run test:integration
```

The script creates a separate member and key, verifies tools from all three upstreams (including the collision names), calls a calculator tool, verifies audit attribution, verifies that disabling a server removes its tools, temporarily makes shipping unreachable while confirming calculator still works, and finally revokes the member key. It restores the modified server configuration even if a check fails. It leaves the test member and its revoked key as useful audit evidence.

## Validation

```powershell
helm lint .\charts\urumi-platform
npm run build
kubectl get pvc,pods,jobs -n urumi
kubectl logs job/urumi-wordpress-bootstrap -n urumi
```

## Production configuration

Use the same chart with `values-prod.yaml`, immutable images in a production registry, production ingress domains, TLS, an appropriate storage class, and an externally managed secret file or secret manager. The complete k3s procedure, including atomic releases and rollback, is in [Production deployment](docs/PRODUCTION_DEPLOYMENT.md).

## Submission material and selected Phase 10 enhancements

- [System design and tradeoffs](docs/SYSTEM_DESIGN.md): component responsibilities, routing, failures, tool collisions, and production differences.
- [Threat model](docs/THREAT_MODEL.md): credential, member-isolation, malicious upstream, SSRF, and TLS risks.
- [Demo runbook](docs/DEMO_RUNBOOK.md): a repeatable two-user video walkthrough.
- [Production deployment](docs/PRODUCTION_DEPLOYMENT.md): k3s, TLS, secrets, immutable images, backup, Helm history, atomic upgrades, and rollback.
- GitHub Actions CI runs the TypeScript/dashboard build and Helm lint for every push and pull request.

Phase 10 selections are production TLS configuration, immutable release-image configuration, CI validation, and documented Helm upgrade/rollback. Multi-store provisioning is intentionally deferred because it is optional and would materially expand the core platform.
