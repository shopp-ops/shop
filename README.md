# shop

E-commerce storefront deployed per-tenant by the Shop operator. Store admins manage products and orders; customers browse and purchase using a Web3 wallet (MetaMask, Ethereum Sepolia).

## Structure

```
shop/
├── api/          # NestJS + Fastify backend
├── web/          # Next.js frontend
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- Docker
- MetaMask browser extension (for testing checkout)

## Local development

**1. Start the database**

```bash
docker compose up -d
```

**2. Configure environment**

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env.local
# Edit api/.env — set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, WALLET_ADDRESS
```

**3. Run the API**

```bash
cd api
npm install
npm run start:dev     # http://localhost:3000
```

**4. Run the web app**

```bash
cd web
npm install
npm run dev           # http://localhost:3001
```

## Roles

| Role | Access |
|---|---|
| Admin | Manage products and view orders — credentials set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars |
| Customer | Browse products, add to cart, pay with MetaMask — no account required |

## Payments

Checkout uses MetaMask on the Ethereum Sepolia testnet. The customer connects their wallet and sends a transaction to the address configured in `WALLET_ADDRESS`. The backend verifies the transaction on-chain before confirming the order.
