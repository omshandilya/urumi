# WordPress URL Fix Script

## Problem
WordPress is configured with domain "example.com" but you're accessing via "127.0.0.1:9090"

## Solution - Update WordPress URLs

Run these commands to fix the URLs:

```powershell
# Get the WordPress pod name
kubectl get pods -n mystore | findstr wordpress

# Update site URL to match your access URL
kubectl exec -n mystore mystore-wordpress-597b79bbcf-h88fn -- bash -c "mysql -h mystore-mysql -u wpuser -pchangeme wordpress -e \"UPDATE wp_options SET option_value='http://127.0.0.1:9090' WHERE option_name='siteurl';\""

kubectl exec -n mystore mystore-wordpress-597b79bbcf-h88fn -- bash -c "mysql -h mystore-mysql -u wpuser -pchangeme wordpress -e \"UPDATE wp_options SET option_value='http://127.0.0.1:9090' WHERE option_name='home';\""

# Verify the change
kubectl exec -n mystore mystore-wordpress-597b79bbcf-h88fn -- bash -c "mysql -h mystore-mysql -u wpuser -pchangeme wordpress -e \"SELECT option_name, option_value FROM wp_options WHERE option_name IN ('siteurl', 'home');\""
```

## After Running Commands

1. Clear your browser cache or use incognito mode
2. Visit: http://127.0.0.1:9090
3. Should now load properly

## Login Credentials

```
URL: http://127.0.0.1:9090/wp-admin
Username: admin
Password: changeme123
```

## Alternative: Use Correct Port Forward

If you want to use port 8080 instead:

```powershell
# Stop current port-forward (Ctrl+C)

# Start new port-forward on 8080
kubectl port-forward -n mystore svc/mystore-wordpress 8080:80

# Update URLs to match
kubectl exec -n mystore mystore-wordpress-597b79bbcf-h88fn -- bash -c "mysql -h mystore-mysql -u wpuser -pchangeme wordpress -e \"UPDATE wp_options SET option_value='http://localhost:8080' WHERE option_name IN ('siteurl', 'home');\""

# Access at: http://localhost:8080
```
