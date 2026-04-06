# Finance Backend API

A role-based finance data processing and access control backend. The system manages financial records, enforces access control across three user roles, and serves aggregated analytics for a dashboard.

Built for the Zorvyn Backend Developer Internship assignment.

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Node.js + TypeScript | 22 / 5.x | Runtime and type safety |
| Express.js | 4.x | HTTP framework |
| PostgreSQL | 16 | Primary database |
| Prisma ORM | 5.x | Type-safe database access and migrations |
| Zod | 3.x | Runtime input validation |
| JSON Web Tokens | 9.x | Stateless authentication |
| bcryptjs | 2.x | Password hashing (12 rounds) |
| express-rate-limit | 8.x | Rate limiting on auth and API routes |
| Swagger UI | 5.x | Interactive API documentation |
| Jest + Supertest | 29 / 7 | Integration testing |
| Docker Compose | — | Local PostgreSQL + pgAdmin setup |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker Desktop
- Git

### 1. Clone and install

```bash
git clone <repo-url>
cd finance-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The defaults in `.env.example` work out of the box with Docker Compose. No edits needed for local development.

```env
DATABASE_URL="postgresql://finance_user:finance_pass@localhost:5433/finance_db"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"
PORT=3000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"
```

> **Note:** The database is exposed on host port **5433** (not 5432) to avoid conflicts with any locally installed PostgreSQL.

### 3. Start the database

```bash
docker compose up -d
```

This starts two containers:
- **PostgreSQL 16** on `localhost:5433`
- **pgAdmin 4** on `http://localhost:5050` (login: `admin@finance.com` / `admin123`)

Wait ~5 seconds for PostgreSQL to finish initializing before the next step.

### 4. Run migrations and seed

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

The seed creates three ready-to-use accounts and sample data:

| Role | Email | Password |
|---|---|---|
| Admin | admin@finance.com | Admin@123 |
| Analyst | analyst@finance.com | Analyst@123 |
| Viewer | viewer@finance.com | Viewer@123 |

### 5. Start the server

```bash
npm run dev
```

Server starts at **`http://localhost:3000`**

---

## API Documentation

Interactive Swagger UI (try every endpoint directly in the browser):

**`http://localhost:3000/api/v1/docs`**

OpenAPI JSON spec: `http://localhost:3000/api/v1/docs.json`

---

## Authentication

All protected endpoints require a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

**Get a token:**

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@finance.com", "password": "Admin@123"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": { "id": "...", "email": "admin@finance.com", "role": "ADMIN" }
  }
}
```

Use the returned `token` value as the Bearer token for all subsequent requests.

---

## Role Permissions

| Action | VIEWER | ANALYST | ADMIN |
|---|:---:|:---:|:---:|
| View all financial records | ✓ | — | ✓ |
| View own financial records | ✓ | ✓ | ✓ |
| Create records | — | ✓ | ✓ |
| Update records | — | ✓ (own only) | ✓ (any) |
| Delete records (soft) | — | — | ✓ |
| Dashboard: recent activity | ✓ | ✓ | ✓ |
| Dashboard: summary, trends, categories | — | ✓ (own data) | ✓ (all data) |
| Manage users (role, status, delete) | — | — | ✓ |
| Create categories | — | — | ✓ |

---

## API Endpoints

### Auth

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | No | Create account (defaults to VIEWER role) |
| POST | `/api/v1/auth/login` | No | Login and receive a JWT |
| GET | `/api/v1/auth/me` | Any role | Current user's profile |

### Financial Records

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/api/v1/records` | Any role | List records (paginated, filterable) |
| GET | `/api/v1/records/:id` | Any role | Get a single record |
| POST | `/api/v1/records` | Analyst, Admin | Create a record |
| PATCH | `/api/v1/records/:id` | Analyst, Admin | Update a record |
| DELETE | `/api/v1/records/:id` | Admin | Soft-delete a record |

**Available filters for `GET /api/v1/records`:**
```
?type=INCOME|EXPENSE
?categoryId=<id>
?startDate=2024-01-01
?endDate=2024-12-31
?search=keyword            (case-insensitive search in title and description)
?createdById=<userId>      (Admin only — filter by record creator)
?sortBy=date|amount|createdAt
?sortOrder=asc|desc
?page=1&limit=20           (max limit: 100)
```

### Dashboard

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/api/v1/dashboard/summary` | Analyst, Admin | Total income, expenses, and net balance |
| GET | `/api/v1/dashboard/trends` | Analyst, Admin | Income vs. expense trends by period |
| GET | `/api/v1/dashboard/categories` | Analyst, Admin | Totals broken down by category |
| GET | `/api/v1/dashboard/recent` | Any role | Most recent transactions |

**Available filters for `GET /api/v1/dashboard/trends`:**
```
?period=monthly            (default) — results keyed as "YYYY-MM"
?period=weekly             — results keyed as "YYYY-Www" (ISO week, e.g. "2024-W03")
?startDate=2024-01-01
?endDate=2024-12-31
```

**Available filters for `GET /api/v1/dashboard/categories`:**
```
?type=INCOME|EXPENSE       (optional — filter to one type)
?startDate=2024-01-01
?endDate=2024-12-31
```

**Available filters for `GET /api/v1/dashboard/recent`:**
```
?limit=10                  (default 10, max 50)
```

> **ANALYST scope:** All dashboard endpoints automatically scope results to records the analyst created. ADMIN sees all records.

### Users (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/users` | List all users (paginated) |
| GET | `/api/v1/users/:id` | Get a user's details |
| PATCH | `/api/v1/users/:id/role` | Change a user's role |
| PATCH | `/api/v1/users/:id/status` | Activate or deactivate a user |
| DELETE | `/api/v1/users/:id` | Soft-delete a user |

### Categories

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/api/v1/categories` | Any role | List all categories |
| POST | `/api/v1/categories` | Admin | Create a new category |

---

## Response Format

Every response — success or error — uses the same envelope:

**Success:**
```json
{
  "success": true,
  "message": "Records retrieved.",
  "data": { "records": [...] },
  "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

**Validation error:**
```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": { "amount": ["Amount must be greater than zero"] }
}
```

**Other error:**
```json
{
  "success": false,
  "message": "Record not found."
}
```

**Monetary amounts** are always returned as strings (e.g., `"amount": "1234.5000"`) to prevent JavaScript floating-point precision loss during JSON serialization.

---

## Running Tests

Tests require a running PostgreSQL instance (the Docker Compose one works). Each test file creates and cleans up its own isolated data.

```bash
# Run all integration tests
npm test

# With coverage report
npm test -- --coverage
```

---

## Project Structure

```
src/
├── app.ts                  # Express app setup, middleware stack
├── server.ts               # HTTP server entry point
├── config/                 # Environment config, Swagger setup
├── lib/                    # Prisma client, JWT utils, pagination, rate limiters
├── middleware/             # authenticate, authorize, validate, errorHandler
├── modules/
│   ├── auth/               # Register, login, profile
│   ├── records/            # Financial record CRUD + filtering
│   ├── dashboard/          # Aggregated analytics endpoints
│   ├── users/              # User management (Admin)
│   └── categories/         # Category reference data
├── types/                  # Shared TypeScript types
└── utils/                  # AppError, asyncHandler

prisma/
├── schema.prisma           # Data models and database schema
└── seed.ts                 # Seed script (users, categories, sample records)

tests/
├── auth.test.ts
├── records.test.ts
├── users.test.ts
└── dashboard.test.ts
```

---

## Design Decisions

These decisions are documented here because they reflect deliberate tradeoffs, not defaults.

### 1. `DECIMAL(18, 4)` not `Float` for monetary amounts

Floating-point types (`Float`, `Double`) cannot represent most decimal fractions exactly — `0.1 + 0.2` evaluates to `0.30000000000000004` in IEEE 754. For financial data, imprecision is unacceptable. `DECIMAL(18, 4)` stores values with exact precision.

Amounts are additionally serialized as strings in JSON responses to prevent JavaScript's `Number` type from re-introducing the same imprecision on the client side.

### 2. PostgreSQL over a document database

Financial data is relational: transactions reference users and categories; dashboard queries aggregate across those relationships. PostgreSQL's `DECIMAL` type, foreign key constraints, and `DATE_TRUNC` aggregation functions make it the correct fit. A document database would require application-level joins and lose the precision guarantees.

### 3. Soft delete everywhere

Neither users nor financial records are ever hard-deleted. A `deletedAt` timestamp marks them as deleted instead. Reasons:

- **Audit trail:** A finance system must be able to answer "what existed before this was removed?"
- **Regulatory compliance:** Hard deletion of financial records can violate data retention policies.
- **Referential integrity:** Hard-deleting a user who owns records would either cascade-delete those records (data loss) or leave orphaned rows.

All queries enforce `WHERE deleted_at IS NULL` through a single centralised `buildWhereClause` helper so the filter cannot be accidentally omitted.

### 4. Database lookup on every authenticated request

The `authenticate` middleware verifies the JWT signature and then queries the database to confirm the user is still active. Pure stateless JWT validation is faster but means a deactivated account's token stays valid until it naturally expires.

In a finance system, if an admin deactivates an employee's account, that access must be revoked immediately. The DB lookup enforces this at the cost of one indexed primary key query per request — acceptable for this use case.

In production this would be optimised with a short-TTL Redis cache (e.g., 60 seconds), balancing immediate revocation against query load.

### 5. Raw SQL for trend aggregations

Prisma's `groupBy` does not support time-bucketing functions like `DATE_TRUNC`. The trends endpoint (`/dashboard/trends`) uses `prisma.$queryRawUnsafe` with PostgreSQL's `DATE_TRUNC('month'/'week', date)`. This is a deliberate, documented use of raw SQL for a capability the ORM does not expose — not a shortcut. All user-supplied values are parameterized; only the period unit (`'month'` or `'week'`) is interpolated, and it is constrained to those two values by the TypeScript type system before the query runs.

### 6. RBAC as an explicit allowlist

The `authorize` middleware takes an explicit list of permitted roles: `authorize([Role.ADMIN, Role.ANALYST])`. This is an allowlist rather than a hierarchy check (e.g., `userRole >= ANALYST`).

A hierarchy check silently breaks if a non-hierarchical role is added later (e.g., an `AUDITOR` who can read everything but not write). An allowlist makes each route's access policy visible at the route definition level and requires no implicit assumptions about ordering.

### 7. Category as a database table, not a code enum

Categories are runtime-configurable reference data, not a code concept. If they were a TypeScript/Prisma enum, adding a new category would require a code change and a redeployment. As a database table, an Admin can create categories through the API at any time.

---

## Assumptions

1. **Self-registration defaults to VIEWER.** In production, new accounts might require admin approval. Here, self-registration is allowed but the minimum-privilege VIEWER role is assigned. An admin must explicitly elevate a role.

2. **ANALYST sees only their own records.** The assignment left ANALYST visibility scope undefined. The assumption is that an analyst is accountable for the records they enter. Admins have full visibility across all records.

3. **VIEWER has read access to all records.** The assignment describes VIEWER as viewing "dashboard data." This implementation treats VIEWER as a read-only role with full read access — they can list and view records but cannot create, update, or delete anything. The reasoning: `GET /dashboard/recent` already returns financial records, so blocking `GET /records` for VIEWERs would be an inconsistent restriction. If a stricter interpretation is needed, the route guard on `GET /records` can be changed from `authenticate` to `authorize([Role.ADMIN, Role.ANALYST])` in a single line.

4. **Amounts have at most 4 decimal places.** `DECIMAL(18, 4)` supports up to 18 significant digits with 4 decimal places, which covers all realistic financial use cases.

5. **No refresh tokens.** Tokens expire after 24 hours. In production a short-lived access token (15 min) + long-lived refresh token pattern would be used. This is noted as a production consideration.

---

## Known Limitations & Production Considerations

| Area | Current state | Production approach |
|---|---|---|
| Token revocation | No blacklist; deactivation enforced via DB lookup | Redis token blacklist or refresh token rotation |
| Rate limiting | General: 100 req/min; Auth: 10 req/15 min (in-memory) | Redis-backed store for distributed deployments |
| Refresh tokens | Not implemented | Short-lived access + long-lived refresh token pair |
| Horizontal scaling | Stateless JWT is ready | Shared Redis needed if session state is added |
| Input sanitization | Zod type validation | DOMPurify or equivalent if strings are rendered in HTML |
| Audit log | `createdAt` / `updatedAt` only | Dedicated append-only audit log table for all mutations |
| HTTPS | Not enforced | TLS termination at load balancer or reverse proxy |
