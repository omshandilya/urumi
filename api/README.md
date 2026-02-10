# API

Node.js backend for WooCommerce store provisioning.

## Setup

```bash
cd api
npm install
cp .env.example .env
```

## Configuration

Ensure your `KUBECONFIG` is set and you have access to a Kubernetes cluster with Helm installed.

## Run

```bash
npm start
```

## Endpoints

### Create Store
```bash
POST /stores
Content-Type: application/json

{
  "domain": "mystore.example.com",
  "adminEmail": "admin@example.com",
  "storeName": "My Store"
}
```

### List Stores
```bash
GET /stores
```

### Delete Store
```bash
DELETE /stores/:id
```

## Features

- Concurrent store creation with unique IDs
- Kubernetes namespace management
- Helm chart deployment automation
- Real-time pod status tracking
- Persistent store metadata
- Comprehensive error handling and logging
