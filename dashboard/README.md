# Dashboard

React frontend for the WooCommerce store provisioning platform.

## Setup

```bash
cd dashboard
npm install
cp .env.example .env
```

## Configuration

Edit `.env` to point to your API:
```
REACT_APP_API_URL=http://localhost:3000
```

## Development

```bash
npm start
```

Opens at http://localhost:3001

## Build

```bash
npm run build
```

## Features

- Create new WooCommerce stores
- View all stores with real-time status
- Delete stores
- Auto-refresh every 5 seconds
- Disable actions during provisioning
