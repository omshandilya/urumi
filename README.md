# Urumi MCP Gateway on Kubernetes

This repository currently implements Phases 1–3: a local Kind cluster, a persistent WooCommerce store deployed with Helm, and a custom Streamable HTTP MCP server. The gateway, dashboard, users, and chat agent are intentionally Phase 4+ work.

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

## Validation

```powershell
helm lint .\charts\urumi-platform
npm run build
kubectl get pvc,pods,jobs -n urumi
kubectl logs job/urumi-wordpress-bootstrap -n urumi
```

## Production configuration

Use the same chart with `values-prod.yaml`, a production image registry, production ingress domain, appropriate storage class, and an externally managed secret file or secret manager. See the assignment brief for Phase 9 requirements.
