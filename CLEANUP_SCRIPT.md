# Cleanup Failed Stores Script

## Remove all failed store namespaces

```powershell
# List all store namespaces
kubectl get namespaces | findstr store-

# Delete specific failed stores
kubectl delete namespace store-c3b124b0
kubectl delete namespace store-4195f9dd
kubectl delete namespace store-0dffb508
kubectl delete namespace store-ecac3fa5
kubectl delete namespace store-sf654a65
kubectl delete namespace store-sff4b74e

# Or delete all at once
kubectl get namespaces -o name | findstr store- | ForEach-Object { kubectl delete $_ }
```

## Clean API data

```powershell
cd api
del data\stores.json
del data\values-*.yaml
```

## Restart API

```powershell
# Stop API (Ctrl+C)
# Start fresh
npm start
```

## Test Store Creation

```powershell
curl -X POST http://localhost:3000/stores -H "Content-Type: application/json" -d "{\"domain\":\"newstore.local\",\"storeName\":\"New Store\",\"adminEmail\":\"admin@newstore.local\"}"
```
