# Urumi - Kubernetes WooCommerce Store Provisioning Platform

Production-ready platform for provisioning and managing WooCommerce stores on Kubernetes using Helm.

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   React     │─────▶│  Node.js API │─────▶│   Kubernetes    │
│  Dashboard  │      │   (Express)  │      │   + Helm        │
└─────────────┘      └──────────────┘      └─────────────────┘
                            │                        │
                            ▼                        ▼
                     ┌──────────────┐      ┌─────────────────┐
                     │ Store        │      │ WooCommerce     │
                     │ Metadata     │      │ + MySQL Pods    │
                     │ (JSON)       │      │ (per namespace) │
                     └──────────────┘      └─────────────────┘
```

### Components

**Dashboard (React)**
- Create/delete stores via UI
- Real-time status polling
- Store list with metadata

**API (Node.js + Express)**
- REST endpoints for store management
- Helm CLI integration for deployments
- Kubernetes API for status tracking
- Persistent store metadata

**Helm Chart**
- WordPress + WooCommerce deployment
- MySQL StatefulSet with persistent storage
- Automated WooCommerce setup via init containers
- Namespace isolation per store

## 🎯 Design Decisions

### Kubernetes & Helm

**Why Helm?**
- Templating for multi-tenant deployments
- Version control for store configurations
- Rollback capabilities
- Package management for complex apps

**Why Namespace Isolation?**
- Security: Each store is isolated
- Resource quotas per store
- Easy cleanup (delete namespace = delete everything)
- No resource name conflicts

**Why StatefulSet for MySQL?**
- Stable network identity
- Persistent storage lifecycle
- Ordered deployment/scaling

**Why Init Containers?**
- WordPress core installation before main container
- WooCommerce plugin setup with idempotency
- Ensures store is ready on first boot

### API Design

**Async Store Creation**
- Returns 202 Accepted immediately
- Helm deployment happens in background
- Status polling via GET /stores

**Metadata Persistence**
- JSON file for simplicity (production: use database)
- In-memory cache for fast reads
- Atomic writes to prevent corruption

## 🚀 Local Setup

### Prerequisites

- Node.js 18+
- Docker Desktop with Kubernetes enabled
- Helm 3+
- kubectl configured

### 1. Start Kubernetes

```bash
# Enable Kubernetes in Docker Desktop
# Verify cluster is running
kubectl cluster-info
```

### 2. Install API

```bash
cd api
npm install
cp .env.example .env
npm start
```

API runs on http://localhost:3000

### 3. Install Dashboard

```bash
cd dashboard
npm install
cp .env.example .env
npm start
```

Dashboard runs on http://localhost:3001

### 4. Verify Helm Chart

```bash
cd helm/store
helm lint .
```

## 📦 Provisioning Stores

### Via Dashboard

1. Open http://localhost:3001
2. Fill in domain (e.g., `mystore.local`)
3. Click "Create Store"
4. Wait for status to change from "Provisioning" to "Ready"

### Via API

```bash
# Create store
curl -X POST http://localhost:3000/stores \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "mystore.local",
    "storeName": "My Store",
    "adminEmail": "admin@mystore.local"
  }'

# List stores
curl http://localhost:3000/stores

# Delete store
curl -X DELETE http://localhost:3000/stores/{store-id}
```

### Via Helm (Manual)

```bash
cd helm/store
helm install mystore . -f values.yaml
```

## 🧪 Testing End-to-End Order Flow

### 1. Access Store

```bash
# Get store URL from dashboard or:
kubectl get ingress -n store-{id}

# Port-forward if no ingress controller
kubectl port-forward -n store-{id} svc/mystore-wordpress 8080:80
```

Open http://localhost:8080

### 2. Login to WordPress Admin

- URL: http://localhost:8080/wp-admin
- Username: `admin` (from values.yaml)
- Password: Check generated values or use default from chart

### 3. Verify WooCommerce

- Navigate to WooCommerce → Products
- Sample product should exist with price $29.99
- Stock: 100 units

### 4. Place Test Order

1. Visit store homepage
2. Add sample product to cart
3. Proceed to checkout
4. Fill in billing details
5. Select "Cash on Delivery" payment
6. Place order

### 5. Verify Order in Admin

- WooCommerce → Orders
- Order should appear with "Processing" status

## 🏭 Production Deployment (k3s)

### Setup k3s Cluster

```bash
# Install k3s
curl -sfL https://get.k3s.io | sh -

# Copy kubeconfig
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER ~/.kube/config
```

### Deploy API

```bash
# Build Docker image
cd api
docker build -t urumi-api:latest .

# Deploy to k3s
kubectl create namespace urumi
kubectl create configmap api-config --from-file=helm/store -n urumi
kubectl apply -f k8s/api-deployment.yaml
```

### Deploy Dashboard

```bash
cd dashboard
npm run build

# Serve via nginx or deploy to k8s
kubectl apply -f k8s/dashboard-deployment.yaml
```

### Configure Ingress

```bash
# Install ingress controller (Traefik comes with k3s)
kubectl apply -f k8s/ingress.yaml
```

### Storage Class

```bash
# k3s uses local-path by default
# For production, use:
# - Longhorn (distributed storage)
# - NFS provisioner
# - Cloud provider storage (EBS, GCE PD)
```

## 🔍 Monitoring & Debugging

### Check Store Status

```bash
# List all stores
kubectl get namespaces | grep store-

# Check pods in store namespace
kubectl get pods -n store-{id}

# View logs
kubectl logs -n store-{id} {pod-name}

# Describe deployment
kubectl describe deployment -n store-{id}
```

### Common Issues

**Store stuck in "Provisioning"**
```bash
kubectl get pods -n store-{id}
kubectl describe pod -n store-{id} {pod-name}
```

**MySQL not ready**
```bash
kubectl logs -n store-{id} mystore-mysql-0
```

**WooCommerce setup failed**
```bash
kubectl logs -n store-{id} {wordpress-pod} -c woocommerce-setup
```

## ⚖️ Tradeoffs & Limitations

### Current Implementation

**Pros:**
- Simple architecture, easy to understand
- Fast provisioning (~2-3 minutes)
- Complete isolation per store
- Automated WooCommerce setup

**Cons:**
- No multi-replica WordPress (shared storage needed)
- JSON file for metadata (not scalable)
- No backup/restore mechanism
- No resource quotas per store
- No monitoring/alerting

### Production Considerations

**What's Missing:**

1. **Database for Metadata**
   - Current: JSON file
   - Production: PostgreSQL/MongoDB

2. **Persistent Volume Management**
   - Current: Local storage
   - Production: Distributed storage (Longhorn, Rook-Ceph)

3. **Backup & Disaster Recovery**
   - MySQL backups (Velero, custom CronJobs)
   - WordPress file backups

4. **Monitoring**
   - Prometheus + Grafana
   - Store health checks
   - Resource usage tracking

5. **Security**
   - TLS/SSL certificates (cert-manager)
   - Network policies
   - Pod security policies
   - Secret management (Vault, Sealed Secrets)

6. **Scaling**
   - Horizontal pod autoscaling
   - Cluster autoscaling
   - Multi-region support

7. **CI/CD**
   - Automated testing
   - GitOps (ArgoCD, Flux)
   - Canary deployments

## 🔮 Future Improvements

### Short Term
- [ ] Add resource quotas per store
- [ ] Implement health checks
- [ ] Add store update endpoint
- [ ] Support custom WooCommerce plugins
- [ ] Email notifications on store ready

### Medium Term
- [ ] Multi-replica WordPress with shared storage
- [ ] Automated backups
- [ ] Store templates (different tiers)
- [ ] Custom domain management
- [ ] SSL certificate automation

### Long Term
- [ ] Multi-cluster support
- [ ] Store migration between clusters
- [ ] Advanced monitoring dashboard
- [ ] Cost tracking per store
- [ ] Auto-scaling based on traffic

## 📊 Performance Metrics

**Store Provisioning Time:**
- Namespace creation: ~1s
- Helm install: ~30s
- MySQL ready: ~60s
- WordPress init: ~45s
- WooCommerce setup: ~30s
- **Total: ~2-3 minutes**

**Resource Usage (per store):**
- WordPress: 256Mi RAM, 250m CPU
- MySQL: 512Mi RAM, 500m CPU
- Storage: 5Gi (WordPress) + 10Gi (MySQL)

## 🤝 Contributing

This is an interview project demonstrating:
- Kubernetes orchestration
- Helm templating
- REST API design
- React frontend
- DevOps best practices

## 📝 License

TBD
