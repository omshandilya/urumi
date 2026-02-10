# WooCommerce Store Helm Chart

Helm chart for deploying a single WooCommerce store instance.

## Prerequisites

- Kubernetes cluster
- Helm 3+
- MySQL database
- Kubernetes Secret with MySQL credentials

## Create MySQL Secret

```bash
kubectl create secret generic mysql-credentials \
  --from-literal=username=<DB_USER> \
  --from-literal=password=<DB_PASSWORD> \
  --namespace=<NAMESPACE>
```

## Installation

```bash
# Local environment
helm install my-store . -f values-local.yaml

# Production environment
helm install my-store . -f values-prod.yaml
```

## Configuration

Key values:
- `namespace` - Kubernetes namespace
- `store.domain` - Store domain name
- `mysql.secretName` - Name of MySQL credentials secret
- `wordpress.storage.size` - Storage size for WordPress files

See `values.yaml` for all options.
