# Troubleshooting: Pods Stuck in Pending Status

## Problem
```
mystore-mysql-0                     0/1     Pending   0          171m
mystore-wordpress-79bc8d978-j5t2h   0/1     Pending   0          171m
```

## Root Cause
Pods cannot start because PersistentVolumeClaims (PVCs) cannot be bound. This happens when:
1. StorageClass doesn't exist
2. No PersistentVolumes available
3. Storage provisioner not configured

## Diagnosis Commands

### Step 1: Check Pod Events
```bash
kubectl describe pod -n mystore mystore-mysql-0
kubectl describe pod -n mystore mystore-wordpress-79bc8d978-j5t2h
```

Look for events like:
- `FailedScheduling`
- `pod has unbound immediate PersistentVolumeClaims`

### Step 2: Check PVC Status
```bash
kubectl get pvc -n mystore
```

Expected output showing `Pending`:
```
NAME                        STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS
mystore-wordpress-pvc       Pending                                      standard
mysql-storage-mystore-mysql-0  Pending                                   standard
```

### Step 3: Check StorageClass
```bash
kubectl get storageclass
```

For k3s, you should see:
```
NAME                   PROVISIONER             RECLAIMPOLICY
local-path (default)   rancher.io/local-path   Delete
```

## Solution

The issue is that your values.yaml specifies `storageClass: standard` but k3s uses `local-path`.

### Fix Option 1: Update values.yaml (Recommended)

Edit `helm/store/values.yaml`:

```yaml
wordpress:
  storage:
    size: 5Gi
    storageClass: local-path  # Changed from 'standard'

mysql:
  storage:
    size: 10Gi
    storageClass: local-path  # Changed from 'standard'
```

Then upgrade the release:
```bash
helm upgrade mystore . -f values.yaml --namespace mystore
```

### Fix Option 2: Use Default StorageClass

Remove storageClass specification to use cluster default:

```yaml
wordpress:
  storage:
    size: 5Gi
    storageClass: ""  # Use default

mysql:
  storage:
    size: 10Gi
    storageClass: ""  # Use default
```

### Fix Option 3: Uninstall and Reinstall

```bash
# Delete current release
helm uninstall mystore --namespace mystore

# Delete namespace to clean up PVCs
kubectl delete namespace mystore

# Wait for namespace deletion
kubectl get namespace mystore

# Update values.yaml with correct storageClass

# Reinstall
helm install mystore . -f values.yaml
```

## Verification

After applying the fix:

```bash
# Watch PVCs bind
kubectl get pvc -n mystore -w

# Should change to:
# NAME                              STATUS   VOLUME
# mystore-wordpress-pvc             Bound    pvc-xxxxx
# mysql-storage-mystore-mysql-0     Bound    pvc-yyyyy

# Watch pods start
kubectl get pods -n mystore -w

# Should change to:
# NAME                                READY   STATUS    RESTARTS   AGE
# mystore-mysql-0                     1/1     Running   0          2m
# mystore-wordpress-79bc8d978-j5t2h   1/1     Running   0          3m
```

## Quick Fix Commands

```bash
# 1. Check what storageClass k3s has
kubectl get storageclass

# 2. Delete current deployment
helm uninstall mystore --namespace mystore
kubectl delete namespace mystore

# 3. Update values.yaml (see below)

# 4. Reinstall
helm install mystore . -f values.yaml
```

## Prevention

For future deployments, always check available StorageClasses first:

```bash
kubectl get storageclass
```

Then use the appropriate class in your values files.
