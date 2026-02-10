# How to Access Your WooCommerce Store

## After Creating a Store via Dashboard

When you create a store through the dashboard, follow these steps to access it:

### Step 1: Wait for Store to be Ready

In the dashboard, watch the **Status** column:
- **Provisioning** → Store is being created (wait 2-3 minutes)
- **Running** → Store is ready to access
- **Failed** → Something went wrong, delete and try again

### Step 2: Get the Store Namespace

From the dashboard, note your **Store ID** (e.g., `s8889b3b`)

The namespace will be: `store-{store-id}`
Example: `store-s8889b3b`

### Step 3: Port Forward to Access the Store

Open a terminal and run:

```powershell
kubectl port-forward -n store-{store-id} svc/{store-id}-wordpress 9090:80
```

Example for store ID `s8889b3b`:
```powershell
kubectl port-forward -n store-s8889b3b svc/s8889b3b-wordpress 9090:80
```

Keep this terminal open!

### Step 4: Access Your Store

Open your browser to:
- **Store Homepage**: http://127.0.0.1:9090
- **Admin Login**: http://127.0.0.1:9090/wp-admin
- **WooCommerce**: http://127.0.0.1:9090/wp-admin (after login)

### Step 5: Login Credentials

```
Username: admin
Password: (auto-generated, check values file or use default)
```

To get the password:
```powershell
kubectl get secret -n store-{store-id} {store-id}-mysql-secret -o jsonpath="{.data.password}" | base64 -d
```

### Step 6: Fix WordPress URL (Important!)

The store needs to know its access URL. Run this command:

```powershell
kubectl exec -n store-{store-id} {store-id}-mysql-0 -- mysql -u wpuser -p{password} wordpress_{store-id} -e "UPDATE wp_options SET option_value='http://127.0.0.1:9090' WHERE option_name IN ('siteurl', 'home');"
```

Replace:
- `{store-id}` with your actual store ID
- `{password}` with the MySQL password from values

### Quick Example for Store s8889b3b

```powershell
# 1. Port forward
kubectl port-forward -n store-s8889b3b svc/s8889b3b-wordpress 9090:80

# 2. In another terminal, fix URLs
kubectl exec -n store-s8889b3b s8889b3b-mysql-0 -- mysql -u wp_s8889b3b -p wordpress_s8889b3b -e "UPDATE wp_options SET option_value='http://127.0.0.1:9090' WHERE option_name IN ('siteurl', 'home');"

# 3. Open browser
start http://127.0.0.1:9090
```

## Alternative: Use Different Port

If port 9090 is busy, use any other port:

```powershell
kubectl port-forward -n store-{store-id} svc/{store-id}-wordpress 8080:80
```

Then access at: http://127.0.0.1:8080

Remember to update WordPress URLs to match!

## Troubleshooting

### Store Not Loading
- Check pods are running: `kubectl get pods -n store-{store-id}`
- Check logs: `kubectl logs -n store-{store-id} {pod-name}`

### Port Forward Disconnects
- Just restart the command
- Port forwards can timeout after inactivity

### Wrong URL in WordPress
- Run the MySQL UPDATE command again with correct port
- Clear browser cache

## Production Setup (Optional)

For permanent access without port-forward:

1. **Configure Ingress** with real domain
2. **Add DNS entry** pointing to your cluster
3. **Setup SSL/TLS** with cert-manager
4. **Update WordPress URLs** to use real domain

Example:
```powershell
kubectl exec -n store-{store-id} {store-id}-mysql-0 -- mysql -u wpuser -p wordpress_{store-id} -e "UPDATE wp_options SET option_value='https://mystore.example.com' WHERE option_name IN ('siteurl', 'home');"
```
