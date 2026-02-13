# Urumi - Kubernetes Store Provisioning Platform

Multi-tenant WooCommerce store provisioning platform built on Kubernetes with Helm.

## Features

- 🚀 One-click store creation via React dashboard
- 🔒 Complete namespace isolation per store
- 📦 Helm-based deployment (local & production)
- 🛍️ Fully functional WooCommerce stores
- 🗑️ Clean resource deletion
- 📊 Real-time status tracking
- 🔐 Auto-generated secure credentials

## Architecture

```
Dashboard (React) → API (Node.js) → Helm → Kubernetes
                                            ↓
                                    Isolated Namespaces
                                    (WordPress + MySQL)
```

## Quick Start

### Prerequisites
- Kubernetes cluster (k3s/k3d/minikube)
- Helm 3+
- Node.js 18+

### 1. Start API
```bash
cd api
npm install
npm start
```

### 2. Start Dashboard
```bash
cd dashboard
npm install
npm start
```

### 3. Create Store
1. Open http://localhost:3001
2. Fill form and click "Create Store"
3. Wait 2-3 minutes for "Ready" status

### 4. Access Store
```bash
kubectl port-forward -n store-{id} svc/{id}-wordpress 9090:80
```

Login: `admin` / `admin123`

## Project Structure

```
urumi/
├── api/                 # Node.js backend
├── dashboard/           # React frontend
├── helm/store/          # Helm chart
│   ├── values.yaml
│   ├── values-local.yaml
│   └── values-prod.yaml
└── scripts/             # Helper scripts
```

## Tech Stack

- **Frontend:** React 18
- **Backend:** Node.js + Express
- **Orchestration:** Kubernetes + Helm
- **Database:** MySQL 8
- **CMS:** WordPress + WooCommerce

## Production Deployment

See [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) for production setup on VPS with k3s.

## Demo

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for presentation guide.

## License

MIT
