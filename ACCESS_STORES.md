# How to Access Your Stores

## Check Store Status

```bash
# See all store namespaces
kubectl get namespaces | findstr store

# Check pods for store c3b124b0
kubectl get pods -n store-c3b124b0

# Wait until you see:
# c3b124b0-mysql-0                    1/1     Running
# c3b124b0-wordpress-xxxxx            1/1     Running
```

## Access Store c3b124b0

Once pods are Running (takes 2-3 minutes):

```bash
# Port-forward to access the store
kubectl port-forward -n store-c3b124b0 svc/c3b124b0-wordpress 9091:80
```

Then open: **http://localhost:9091**

## Access Multiple Stores Simultaneously

Each store needs a different local port:

```bash
# Terminal 1 - Original store (mystore)
kubectl port-forward -n mystore svc/mystore-wordpress 9090:80

# Terminal 2 - Store c3b124b0
kubectl port-forward -n store-c3b124b0 svc/c3b124b0-wordpress 9091:80

# Terminal 3 - Store c3b124b0 (if you create another)
kubectl port-forward -n store-{new-id} svc/{new-id}-wordpress 9092:80
```

## WordPress Admin Login

For store c3b124b0:
- URL: http://localhost:9091/wp-admin
- Username: `admin`
- Password: Check the generated values file or use the one from your Helm chart

## Quick Commands

```bash
# Watch store provisioning
kubectl get pods -n store-c3b124b0 -w

# Check logs if stuck
kubectl logs -n store-c3b124b0 -l app=wordpress

# Get service name
kubectl get svc -n store-c3b124b0
```
