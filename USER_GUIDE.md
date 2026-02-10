# User Guide - Accessing Your Store

## ✅ Default Credentials (All Stores)

**Username:** `admin`
**Password:** `admin123`

These credentials work for ALL stores you create!

## 📋 How to Access Your Store

### Step 1: Create Store in Dashboard
1. Go to http://localhost:3001
2. Fill in store details
3. Click "Create Store"
4. Wait for status to show "Ready"

### Step 2: Note Your Store ID
The dashboard shows your Store ID (e.g., `sf04133d`)

### Step 3: Port Forward
```powershell
kubectl port-forward -n store-{your-store-id} svc/{your-store-id}-wordpress 9090:80
```

Example for store `sf04133d`:
```powershell
kubectl port-forward -n store-sf04133d svc/sf04133d-wordpress 9090:80
```

### Step 4: Login
- URL: http://127.0.0.1:9090/wp-admin
- Username: `admin`
- Password: `admin123`

## 🎯 Quick Access for Store sf04133d

```powershell
kubectl port-forward -n store-sf04133d svc/sf04133d-wordpress 9090:80
```

Then:
- Homepage: http://127.0.0.1:9090
- Admin: http://127.0.0.1:9090/wp-admin
- Username: `admin`
- Password: `admin123`

## 📝 Credentials Shown in Dashboard

The dashboard now displays:
- Store ID
- Status
- Domain
- **Credentials** (username & password)
- Created timestamp
- Actions

You can click "Copy" to copy credentials to clipboard!

## 🔒 Security Note

**For Production:**
- Change default password after first login
- Use strong passwords
- Enable 2FA
- Use environment-specific credentials

**For Development/Testing:**
- Default `admin/admin123` is fine
- Easy to remember
- Consistent across all stores
