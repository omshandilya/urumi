# Step-by-Step Deployment & Testing Guide

## Current Status

You have successfully deployed a Helm release:
```
NAME: mystore
NAMESPACE: default
STATUS: deployed
CHART: store-0.1.0
```

## 🎯 What Happens Next

Your WooCommerce store is being provisioned. Here's what's happening behind the scenes:

1. **Namespace Creation** - `mystore` namespace created
2. **MySQL Deployment** - StatefulSet spinning up
3. **WordPress Init** - Installing WordPress core
4. **WooCommerce Setup** - Installing and configuring WooCommerce plugin
5. **Sample Product** - Creating test product with price and stock

## 📋 Step-by-Step Commands

### Step 1: Check Deployment Status

```bash
# View all resources in the namespace
kubectl get all -n mystore

# Expected output:
# - pod/mystore-mysql-0 (StatefulSet)
# - pod/mystore-wordpress-xxxxx (Deployment)
# - service/mystore-mysql
# - service/mystore-wordpress
```

### Step 2: Monitor Pod Status

```bash
# Watch pods until they're all Running
kubectl get pods -n mystore -w

# Wait for:
# mystore-mysql-0                 1/1     Running
# mystore-wordpress-xxxxx         1/1     Running
```

Press `Ctrl+C` to stop watching.

### Step 3: Check Init Container Logs

```bash
# Get WordPress pod name
kubectl get pods -n mystore | grep wordpress

# View WordPress installation logs
kubectl logs -n mystore <wordpress-pod-name> -c wordpress-init

# View WooCommerce setup logs
kubectl logs -n mystore <wordpress-pod-name> -c woocommerce-setup

# Expected output:
# "WordPress installed successfully!"
# "WooCommerce setup complete!"
```

### Step 4: Verify MySQL is Ready

```bash
# Check MySQL pod
kubectl get pod mystore-mysql-0 -n mystore

# View MySQL logs
kubectl logs -n mystore mystore-mysql-0

# Should see: "ready for connections"
```

### Step 5: Access Your Store

Since you're using k3s with Traefik, you have two options:

#### Option A: Port Forward (Easiest)

```bash
# Forward WordPress service to localhost
kubectl port-forward -n mystore svc/mystore-wordpress 8080:80

# Open browser to:
# http://localhost:8080
```

Keep this terminal open while testing.

#### Option B: Configure Ingress (Production-like)

```bash
# Check if ingress was created
kubectl get ingress -n mystore

# Get ingress details
kubectl describe ingress -n mystore mystore-wordpress

# Add to /etc/hosts (Windows: C:\Windows\System32\drivers\etc\hosts)
# 127.0.0.1 example.com

# Access via: http://example.com
```

### Step 6: Login to WordPress Admin

```bash
# Open in browser:
http://localhost:8080/wp-admin

# Credentials (from values.yaml):
Username: admin
Password: changeme123
```

### Step 7: Verify WooCommerce Installation

Once logged in:

1. **Check Dashboard**
   - You should see WooCommerce widgets
   - No setup wizard (already completed)

2. **Navigate to Products**
   ```
   WooCommerce → Products
   ```
   - Should see "Sample Product"
   - Price: $29.99
   - Stock: 100 units

3. **Check Payment Methods**
   ```
   WooCommerce → Settings → Payments
   ```
   - "Cash on Delivery" should be enabled

### Step 8: Test Complete Order Flow

#### A. Place an Order

1. **Visit Store Front**
   ```
   http://localhost:8080
   ```

2. **Add Product to Cart**
   - Click on "Sample Product"
   - Click "Add to Cart"
   - Click "View Cart"

3. **Proceed to Checkout**
   - Click "Proceed to Checkout"
   - Fill in billing details:
     ```
     First Name: Test
     Last Name: User
     Address: 123 Test St
     City: Test City
     Postcode: 12345
     Phone: 1234567890
     Email: test@example.com
     ```

4. **Select Payment Method**
   - Choose "Cash on Delivery"
   - Click "Place Order"

5. **Verify Order Confirmation**
   - Should see "Thank you. Your order has been received."
   - Note the order number

#### B. Verify Order in Admin

1. **Go to Orders**
   ```
   WooCommerce → Orders
   ```

2. **Check Order Details**
   - Order should be listed with status "Processing"
   - Click to view full details
   - Verify product, price, and customer info

### Step 9: Test Store Management

#### Check Store Resources

```bash
# View all resources
kubectl get all -n mystore

# Check persistent volumes
kubectl get pvc -n mystore

# Check secrets
kubectl get secrets -n mystore
```

#### View Resource Usage

```bash
# Check pod resource consumption
kubectl top pods -n mystore

# Check node resources
kubectl top nodes
```

### Step 10: Clean Up (Optional)

```bash
# Delete the store
helm uninstall mystore --namespace mystore

# Delete namespace (removes all resources)
kubectl delete namespace mystore

# Verify deletion
kubectl get namespaces | grep mystore
```

## 🔍 Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see events
kubectl describe pod -n mystore <pod-name>

# Common issues:
# - ImagePullBackOff: Check internet connection
# - CrashLoopBackOff: Check logs
# - Pending: Check storage class availability
```

### MySQL Connection Issues

```bash
# Test MySQL connectivity from WordPress pod
kubectl exec -n mystore <wordpress-pod> -- wp db check --allow-root

# Check MySQL service
kubectl get svc -n mystore mystore-mysql
```

### WooCommerce Not Installed

```bash
# Re-run setup manually
kubectl exec -n mystore <wordpress-pod> -it -- bash

# Inside pod:
wp plugin install woocommerce --activate --allow-root
```

### Storage Issues

```bash
# Check storage class
kubectl get storageclass

# Check PVC status
kubectl get pvc -n mystore

# Describe PVC for events
kubectl describe pvc -n mystore
```

## 🚀 Next Steps with API & Dashboard

### Start the API

```bash
cd api
npm install
npm start

# API runs on http://localhost:3000
```

### Test API Endpoints

```bash
# Create a new store via API
curl -X POST http://localhost:3000/stores \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "store2.local",
    "storeName": "Second Store",
    "adminEmail": "admin@store2.local"
  }'

# List all stores
curl http://localhost:3000/stores

# Delete a store
curl -X DELETE http://localhost:3000/stores/{store-id}
```

### Start the Dashboard

```bash
cd dashboard
npm install
npm start

# Dashboard runs on http://localhost:3001
```

### Use Dashboard

1. Open http://localhost:3001
2. See your existing stores
3. Create new stores with one click
4. Monitor status in real-time
5. Delete stores when done

## 📊 Expected Timeline

| Step | Duration | Status Check |
|------|----------|--------------|
| Helm install | 5s | `helm list` |
| MySQL ready | 60s | `kubectl get pods` |
| WordPress init | 45s | `kubectl logs` |
| WooCommerce setup | 30s | `kubectl logs` |
| **Total** | **~2-3 min** | Access store |

## ✅ Success Criteria

Your deployment is successful when:

- [ ] All pods show `Running` status
- [ ] WordPress admin is accessible
- [ ] WooCommerce is installed and configured
- [ ] Sample product exists with correct price
- [ ] Cash on Delivery payment is enabled
- [ ] You can place a test order
- [ ] Order appears in admin panel

## 🎉 Congratulations!

You now have a fully functional WooCommerce store running on Kubernetes!

**What you've accomplished:**
- Deployed WordPress + MySQL on Kubernetes
- Automated WooCommerce installation
- Configured payment methods
- Created sample products
- Tested complete order flow

**Next challenges:**
- Deploy multiple stores
- Set up custom domains
- Configure SSL/TLS
- Implement backups
- Add monitoring
