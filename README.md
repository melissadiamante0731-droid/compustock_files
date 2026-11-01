# CompuStock Inventory

CompuStock currently contains a browser-only prototype and a first-stage Express/MySQL backend foundation. The existing dashboard still uses browser `localStorage`; it is not yet connected to the API and must not be used as authoritative business data or as secure staff authentication.
The prototype has inline event handlers, so its current Content Security Policy includes an inline-script exception; remove that exception as part of frontend/API integration before production.

## Requirements

- Node.js 20 or newer
- MySQL 8.0 or newer (InnoDB)

## Local setup

1. Create a dedicated MySQL database and least-privilege application user.
2. Copy `.env.example` to `.env` and set a random session secret and database credentials.
3. Install packages with `npm install`.
4. Apply the initial schema using `npm run migrate`.
5. Provision the first administrator using `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables, then run `npm run provision-admin`. Choose a unique password of at least 12 characters and remove the bootstrap values afterward.
6. Start the server with `npm start`; open `http://localhost:3000`.

Set `SESSION_COOKIE_SECURE=true` when deploying behind HTTPS; startup refuses insecure session cookies in production.

The API is under `/api/v1`. `GET /api/v1/health` verifies database connectivity. `GET /api/v1/products` provides a paginated, parameterized product search. Staff sign in through `/api/v1/auth/login`; obtain a CSRF token from `/api/v1/auth/csrf` before state-changing requests and send it as `X-CSRF-Token`. Sessions are stored in MySQL.

`POST /api/v1/inventory/movements` is restricted to Admin and Owner. `POST /api/v1/pos/sales` is available to Admin, Owner, and Cashier and requires an `Idempotency-Key` header. Amounts are calculated from locked database rows. Online checkout, customer accounts, refunds/voids, product administration APIs, and frontend API integration are not implemented yet.

## Initial design decisions

- Stock is decremented within the accepted POS sale transaction. Online-order reservation rules are not implemented yet.
- No payment gateway is connected. POS cash, card, bank transfer, and other payments are recorded as paid only at cashier checkout; no customer-submitted online order is marked paid.
- Database timestamps use MySQL timestamps with a UTC connection timezone. The application should present dates in the configured business timezone when user-facing date support is added.
- Sales retain product name, SKU, unit price, and unit cost snapshots. Referenced products and users are not hard-deleted by these schema relationships.

## Checks

Run `npm test` for the backend's pure validation/configuration tests. Database migration, API integration, frontend, concurrency, backup/restore, and deployment testing still require additional implementation and a dedicated test database.
