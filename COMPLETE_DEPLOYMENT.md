# Complete Deployment Guide - Step by Step

## Current Situation
- Helm release "mystore" is stuck in default namespace
- Namespace "mystore" was deleted but release metadata remains
- Need to clean up and redeploy correctly

## Step 1: Check What's Running

```powershell
# Check all Helm releases
helm list --all-namespaces

# Check if release exists in default namespace
helm list -n default

# Check all namespaces
kubectl get namespaces
```

## Step 2: Clean Up Stuck Release

```powershell
# Delete release from default namespace (where it was originally installed)
helm uninstall mystore -n default

# If that fails, force delete the secret
kubectl delete secret -n default -l owner=helm,name=mystore

# Verify it's gone
helm list --all-namespaces
```

## Step 3: Verify Clean State

```powershell
# Should show no mystore releases
helm list --all-namespaces

# Should show no mystore namespace
kubectl get namespaces | findstr mystore
```

## Step 4: Install Fresh

```powershell
# Navigate to helm chart directory
cd C:\Users\omsha\OneDrive\Attachments\Desktop\Urumi\helm\store

# Install with correct values
helm install mystore . -f values.yaml

# Expected output:
# NAME: mystore
# LAST DEPLOYED: ...
# NAMESPACE: default
# STATUS: deployed
```

## Step 5: Monitor Deployment

```powershell
# Watch pods in mystore namespace
kubectl get pods -n mystore -w

# In another terminal, check PVCs
kubectl get pvc -n mystore

# Check events
kubectl get events -n mystore --sort-by='.lastTimestamp'
```

## Step 6: Wait for Pods to be Running

Expected progression:
```
# Initial (0-30s)
mystore-mysql-0                     0/1     Pending
mystore-wordpress-xxxxx             0/1     Pending

# PVCs bound (30-60s)
mystore-mysql-0                     0/1     Init:0/1
mystore-wordpress-xxxxx             0/1     Init:0/2

# Init containers running (60-120s)
mystore-mysql-0                     0/1     Running
mystore-wordpress-xxxxx             0/1     Init:1/2

# All running (120-180s)
mystore-mysql-0                     1/1     Running
mystore-wordpress-xxxxx             1/1     Running
```

## Step 7: Check Init Container Logs

```powershell
# Get WordPress pod name
kubectl get pods -n mystore | findstr wordpress

# Replace <pod-name> with actual name
kubectl logs -n mystore <pod-name> -c wordpress-init
kubectl logs -n mystore <pod-name> -c woocommerce-setup
```

## Step 8: Access the Store

```powershell
# Port forward to access locally
kubectl port-forward -n mystore svc/mystore-wordpress 8080:80

# Keep this terminal open
# Open browser to: http://localhost:8080
```

## Step 9: Login to WordPress Admin

```
URL: http://localhost:8080/wp-admin
Username: admin
Password: changeme123
```

## Step 10: Verify WooCommerce

1. Dashboard should show WooCommerce widgets
2. Go to: WooCommerce → Products
3. Should see "Sample Product" with price $29.99, stock 100
4. Go to: WooCommerce → Settings → Payments
5. "Cash on Delivery" should be enabled

## Step 11: Test Order Flow

1. Visit http://localhost:8080
2. Click "Sample Product"
3. Click "Add to Cart"
4. Click "View Cart"
5. Click "Proceed to Checkout"
6. Fill in billing details
7. Select "Cash on Delivery"
8. Click "Place Order"
9. Verify order confirmation

## Step 12: Check Order in Admin

1. Go to WooCommerce → Orders
2. Order should appear with "Processing" status

## Step 13: Start API (New Terminal)

```powershell
cd C:\Users\omsha\OneDrive\Attachments\Desktop\Urumi\api

# Install dependencies
npm install

# Create .env file
copy .env.example .env

# Start API
npm start

# Should see: API server running on port 3000
```

## Step 14: Test API (New Terminal)

```powershell
# Create a store via API
curl -X POST http://localhost:3000/stores -H "Content-Type: application/json" -d "{\"domain\":\"store2.local\",\"storeName\":\"Second Store\",\"adminEmail\":\"admin@store2.local\"}"

# List all stores
curl http://localhost:3000/stores
```

## Step 15: Start Dashboard (New Terminal)

```powershell
cd C:\Users\omsha\OneDrive\Attachments\Desktop\Urumi\dashboard

# Install dependencies
npm install

# Create .env file
copy .env.example .env

# Start dashboard
npm start

# Should open browser to: http://localhost:3001
```

## Step 16: Use Dashboard

1. Dashboard shows all stores
2. Create new store using form
3. Watch status change from "Provisioning" to "Ready"
4. Click domain link to access store
5. Delete stores when done

## Troubleshooting Commands

```powershell
# If pods stuck in Pending
kubectl describe pod -n mystore <pod-name>

# If PVC not binding
kubectl get pvc -n mystore
kubectl describe pvc -n mystore <pvc-name>

# If init containers failing
kubectl logs -n mystore <pod-name> -c wordpress-init
kubectl logs -n mystore <pod-name> -c woocommerce-setup

# If MySQL not ready
kubectl logs -n mystore mystore-mysql-0

# Check all resources
kubectl get all -n mystore
```

## Success Checklist

- [ ] Helm release installed successfully
- [ ] All pods showing "Running" status
- [ ] WordPress accessible at http://localhost:8080
- [ ] Can login to wp-admin
- [ ] WooCommerce installed with sample product
- [ ] Can place test order
- [ ] Order appears in admin
- [ ] API running on port 3000
- [ ] Dashboard running on port 3001
- [ ] Can create stores via dashboard
- [ ] Can delete stores via dashboard

## Final Verification

```powershell
# Check everything is running
helm list --all-namespaces
kubectl get pods -n mystore
kubectl get pvc -n mystore
kubectl get svc -n mystore

# Should see:
# - Helm release: mystore (deployed)
# - 2 pods: Running
# - 2 PVCs: Bound
# - 2 services: ClusterIP
```

## Clean Up (When Done)

```powershell
# Delete store via Helm
helm uninstall mystore -n default

# Delete namespace
kubectl delete namespace mystore

# Stop API (Ctrl+C in API terminal)
# Stop Dashboard (Ctrl+C in Dashboard terminal)
```
