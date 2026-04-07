# Finance Backend API — Documentation

A role-based financial records management API supporting CRUD operations on transactions, category management, and aggregated analytics dashboards.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Role Permissions](#role-permissions)
4. [Rate Limiting](#rate-limiting)
5. [Response Format](#response-format)
6. [HTTP Status Codes](#http-status-codes)
7. [Data Models](#data-models)
8. [Endpoints](#endpoints)
   - [Auth](#auth-endpoints)
   - [Records](#records-endpoints)
   - [Dashboard](#dashboard-endpoints)
   - [Users](#users-endpoints)
   - [Categories](#categories-endpoints)
9. [Quick Start Examples](#quick-start-examples)
10. [Environment Variables](#environment-variables)

---

## Overview

| Property | Value |
|----------|-------|
| Base URL | `http://localhost:3000/api/v1` |
| Interactive Docs | `GET /api/v1/docs` (Swagger UI) |
| OpenAPI JSON | `GET /api/v1/docs.json` |
| Health Check | `GET /health` |
| Content-Type | `application/json` |

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5.x |
| Framework | Express.js 4.x |
| Database | PostgreSQL 16 |
| ORM | Prisma 5.x |
| Validation | Zod 3.x |
| Auth | JWT (jsonwebtoken 9.x) |
| Password Hashing | bcryptjs (12 rounds) |

---

## Authentication

This API uses **JWT Bearer tokens**. Protected endpoints require the token in the `Authorization` header.

### How to Authenticate

1. Register a new account or log in to receive a JWT token.
2. Include the token in all subsequent requests.

```
Authorization: Bearer <your-jwt-token>
```

### Token Details

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| Payload | `{ sub: userId, role: userRole }` |
| Expiry | 24 hours (configurable via `JWT_EXPIRES_IN`) |
| Revocation | Token is validated against the database on every request — deactivated accounts are rejected immediately |

---

## Role Permissions

All registered users default to the **VIEWER** role. Admins can change user roles via `PATCH /users/:id/role`.

| Action | VIEWER | ANALYST | ADMIN |
|--------|:------:|:-------:|:-----:|
| View all financial records | Yes | No (own only) | Yes |
| Create financial records | No | Yes | Yes |
| Update own financial records | No | Yes | Yes |
| Update any financial record | No | No | Yes |
| Soft-delete financial records | No | No | Yes |
| View dashboard summary | No | Yes (own) | Yes (all) |
| View dashboard trends | No | Yes (own) | Yes (all) |
| View category breakdown | No | Yes (own) | Yes (all) |
| View recent activity | Yes | Yes | Yes |
| List all users | No | No | Yes |
| Update user roles | No | No | Yes |
| Activate/deactivate users | No | No | Yes |
| Delete users | No | No | Yes |
| Create categories | No | No | Yes |
| View categories | Yes | Yes | Yes |

---

## Rate Limiting

| Limiter | Applies To | Limit | Window |
|---------|-----------|-------|--------|
| General | All `GET /api/v1/*` | 100 requests | Per minute |
| Auth | `POST /auth/register`, `POST /auth/login` | 10 requests | Per 15 minutes |

When exceeded, the server returns **429 Too Many Requests**. Standard `RateLimit-*` headers (RFC 6585) are included in all responses.

---

## Response Format

All responses follow a consistent envelope.

### Success Response

```json
{
  "success": true,
  "message": "Human-readable description",
  "data": { }
}
```

### Paginated Success Response

```json
{
  "success": true,
  "message": "Records retrieved.",
  "data": [ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Validation Error Response

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": {
    "amount": ["Number must be greater than 0"],
    "email": ["Invalid email"]
  }
}
```

### General Error Response

```json
{
  "success": false,
  "message": "Descriptive error message",
  "errors": null
}
```

### Monetary Amounts

Amounts are always returned as **strings** with 4 decimal places to prevent JavaScript floating-point precision loss. The database stores them as `DECIMAL(18,4)`.

```
"amount": "1500.7500"
```

### Timestamps

All timestamps are ISO-8601 UTC strings.

```
"createdAt": "2024-03-15T12:30:45.123Z"
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK — Successful GET, PATCH, or DELETE |
| 201 | Created — Successful POST (resource created) |
| 400 | Bad Request — Validation error or invalid input |
| 401 | Unauthorized — Missing, invalid, or expired token; account deactivated |
| 403 | Forbidden — Authenticated but insufficient role |
| 404 | Not Found — Resource does not exist |
| 409 | Conflict — Unique constraint violation (e.g., duplicate email or category name) |
| 429 | Too Many Requests — Rate limit exceeded |
| 500 | Internal Server Error — Unexpected server error |

---

## Data Models

### User

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (CUID) | Unique identifier |
| `email` | `string` | Unique email address |
| `name` | `string` | Display name |
| `role` | `VIEWER \| ANALYST \| ADMIN` | Access role |
| `isActive` | `boolean` | Whether the account is active |
| `createdAt` | `ISO-8601` | Account creation timestamp |
| `updatedAt` | `ISO-8601` | Last update timestamp |
| `deletedAt` | `ISO-8601 \| null` | Soft-delete timestamp (null = not deleted) |

> `passwordHash` is never returned in API responses.

### Category

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (CUID) | Unique identifier |
| `name` | `string` | Unique category name |
| `type` | `INCOME \| EXPENSE` | Classification type |
| `createdAt` | `ISO-8601` | Creation timestamp |

### FinancialRecord

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (CUID) | Unique identifier |
| `title` | `string` | Short description of the transaction |
| `description` | `string \| null` | Optional longer description |
| `amount` | `string` | Decimal amount (4 decimal places) |
| `type` | `INCOME \| EXPENSE` | Transaction type |
| `date` | `ISO-8601` | Transaction date |
| `categoryId` | `string` | Foreign key to Category |
| `createdById` | `string` | Foreign key to User who created the record |
| `createdAt` | `ISO-8601` | Record creation timestamp |
| `updatedAt` | `ISO-8601` | Last update timestamp |
| `deletedAt` | `ISO-8601 \| null` | Soft-delete timestamp (null = not deleted) |
| `category` | `Category` | Nested category object |
| `createdBy` | `User` | Nested creator object |

> Records are **soft-deleted** — `deletedAt` is set instead of removing the row, preserving the audit trail.

---

## Endpoints

---

## Auth Endpoints

### POST /auth/register

Register a new user account. All new accounts receive the **VIEWER** role by default.

**Authentication:** Not required

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 2–100 characters |
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | 8–72 characters |

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePass123"
}
```

**Response — 201 Created:**

```json
{
  "success": true,
  "message": "Account created successfully.",
  "data": {
    "user": {
      "id": "clx1abc123",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "VIEWER",
      "isActive": true,
      "createdAt": "2024-03-15T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 409 | Email already registered |

---

### POST /auth/login

Authenticate and receive a JWT token.

**Authentication:** Not required

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `password` | string | Yes |

```json
{
  "email": "jane@example.com",
  "password": "SecurePass123"
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "clx1abc123",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "VIEWER",
      "isActive": true,
      "createdAt": "2024-03-15T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 401 | Invalid credentials |
| 401 | Account deactivated |

---

### GET /auth/me

Returns the profile of the currently authenticated user.

**Authentication:** Required (any role)

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "User profile retrieved.",
  "data": {
    "user": {
      "id": "clx1abc123",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "VIEWER",
      "isActive": true,
      "createdAt": "2024-03-15T12:00:00.000Z",
      "updatedAt": "2024-03-15T12:00:00.000Z"
    }
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 401 | Authentication token is required |
| 404 | User not found |

---

## Records Endpoints

All records endpoints require authentication.

### GET /records

Returns a paginated list of financial records.

- **VIEWER / ADMIN:** See all records. ADMIN can additionally filter by `createdById`.
- **ANALYST:** Sees only records they created.

**Authentication:** Required (any role)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `INCOME \| EXPENSE` | — | Filter by record type |
| `categoryId` | string | — | Filter by category ID |
| `startDate` | `YYYY-MM-DD` | — | Filter records on or after this date |
| `endDate` | `YYYY-MM-DD` | — | Filter records on or before this date |
| `createdById` | string | — | Filter by creator ID (Admin only) |
| `search` | string | — | Case-insensitive keyword search across title and description |
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Records per page (max 100) |
| `sortBy` | `date \| amount \| createdAt` | `date` | Sort field |
| `sortOrder` | `asc \| desc` | `desc` | Sort direction |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Records retrieved.",
  "data": [
    {
      "id": "clx2xyz789",
      "title": "Office Supplies",
      "description": "Notebooks and pens",
      "amount": "150.7500",
      "type": "EXPENSE",
      "date": "2024-03-15T00:00:00.000Z",
      "categoryId": "clx3cat001",
      "createdById": "clx1abc123",
      "createdAt": "2024-03-15T12:30:00.000Z",
      "updatedAt": "2024-03-15T12:30:00.000Z",
      "deletedAt": null,
      "category": {
        "id": "clx3cat001",
        "name": "Office Supplies",
        "type": "EXPENSE",
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      "createdBy": {
        "id": "clx1abc123",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "role": "ANALYST"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 85,
    "totalPages": 5
  }
}
```

---

### GET /records/:id

Returns a single financial record by ID.

- **VIEWER / ADMIN:** Can view any record.
- **ANALYST:** Can only view records they created (returns 404 if not the owner).

**Authentication:** Required (any role)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Record ID |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Record retrieved.",
  "data": {
    "record": {
      "id": "clx2xyz789",
      "title": "Office Supplies",
      "description": "Notebooks and pens",
      "amount": "150.7500",
      "type": "EXPENSE",
      "date": "2024-03-15T00:00:00.000Z",
      "categoryId": "clx3cat001",
      "createdById": "clx1abc123",
      "createdAt": "2024-03-15T12:30:00.000Z",
      "updatedAt": "2024-03-15T12:30:00.000Z",
      "deletedAt": null,
      "category": {
        "id": "clx3cat001",
        "name": "Office Supplies",
        "type": "EXPENSE",
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      "createdBy": {
        "id": "clx1abc123",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "role": "ANALYST"
      }
    }
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 404 | Record not found |

---

### POST /records

Creates a new financial record.

**Authentication:** Required (ANALYST, ADMIN)

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | Yes | 1–200 characters |
| `description` | string | No | Max 1000 characters |
| `amount` | number | Yes | > 0, max 4 decimal places |
| `type` | `INCOME \| EXPENSE` | Yes | |
| `categoryId` | string | Yes | Must reference an existing category |
| `date` | `YYYY-MM-DD` | Yes | Valid date |

```json
{
  "title": "Office Supplies",
  "description": "Notebooks and pens for Q1",
  "amount": 150.75,
  "type": "EXPENSE",
  "categoryId": "clx3cat001",
  "date": "2024-03-15"
}
```

**Response — 201 Created:**

```json
{
  "success": true,
  "message": "Record created.",
  "data": {
    "record": { }
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | VIEWER role cannot create records |
| 404 | Category not found |

---

### PATCH /records/:id

Updates an existing financial record. All fields are optional.

- **ANALYST:** Can only update records they created.
- **ADMIN:** Can update any record.

**Authentication:** Required (ANALYST, ADMIN)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Record ID |

**Request Body (all fields optional):**

```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "amount": 200.50,
  "type": "EXPENSE",
  "categoryId": "clx3cat002",
  "date": "2024-04-01"
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Record updated.",
  "data": {
    "record": { }
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | VIEWER role cannot update records |
| 404 | Record not found or you do not own it |
| 404 | Category not found |

---

### DELETE /records/:id

Soft-deletes a financial record. The record is not permanently removed — its `deletedAt` timestamp is set to preserve the audit trail.

**Authentication:** Required (ADMIN only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Record ID |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Record deleted.",
  "data": null
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 403 | Only admins can delete records |
| 404 | Record not found |

---

## Dashboard Endpoints

All dashboard endpoints require authentication.

### GET /dashboard/summary

Returns aggregated totals: income, expenses, and net balance.

- **ANALYST:** Aggregates only their own records.
- **ADMIN:** Aggregates all records.

**Authentication:** Required (ANALYST, ADMIN)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | `YYYY-MM-DD` | Filter from this date |
| `endDate` | `YYYY-MM-DD` | Filter until this date |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Summary retrieved.",
  "data": {
    "totalIncome": "50000.0000",
    "totalExpenses": "32000.0000",
    "netBalance": "18000.0000",
    "recordCount": 47,
    "incomeCount": 25,
    "expenseCount": 22
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 403 | VIEWER cannot access dashboard |

---

### GET /dashboard/trends

Returns income vs. expense totals grouped by time period (monthly or weekly).

- **ANALYST:** Aggregates only their own records.
- **ADMIN:** Aggregates all records.

Period keys:
- Monthly: `"2024-01"`, `"2024-02"`, ...
- Weekly: `"2024-W01"`, `"2024-W02"`, ...

**Authentication:** Required (ANALYST, ADMIN)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | `monthly \| weekly` | `monthly` | Aggregation granularity |
| `startDate` | `YYYY-MM-DD` | — | Filter from this date |
| `endDate` | `YYYY-MM-DD` | — | Filter until this date |

**Response — 200 OK (monthly):**

```json
{
  "success": true,
  "message": "Monthly trends retrieved.",
  "data": [
    {
      "period": "2024-01",
      "income": "15000.0000",
      "expense": "9500.0000",
      "incomeCount": 5,
      "expenseCount": 8
    },
    {
      "period": "2024-02",
      "income": "18000.0000",
      "expense": "11200.0000",
      "incomeCount": 6,
      "expenseCount": 9
    }
  ]
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 403 | VIEWER cannot access dashboard |

---

### GET /dashboard/categories

Returns totals grouped by category.

- **ANALYST:** Aggregates only their own records.
- **ADMIN:** Aggregates all records.

**Authentication:** Required (ANALYST, ADMIN)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `INCOME \| EXPENSE` | Filter by record type |
| `startDate` | `YYYY-MM-DD` | Filter from this date |
| `endDate` | `YYYY-MM-DD` | Filter until this date |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Category breakdown retrieved.",
  "data": [
    {
      "categoryId": "clx3cat001",
      "categoryName": "Salaries",
      "type": "INCOME",
      "total": "45000.0000",
      "count": 12
    },
    {
      "categoryId": "clx3cat002",
      "categoryName": "Office Supplies",
      "type": "EXPENSE",
      "total": "3500.0000",
      "count": 15
    }
  ]
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 403 | VIEWER cannot access dashboard |

---

### GET /dashboard/recent

Returns the most recent financial records.

- **ANALYST:** Returns their own most recent records.
- **VIEWER / ADMIN:** Returns the most recent records overall.

**Authentication:** Required (any role)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `10` | Number of records to return (max 50) |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Recent activity retrieved.",
  "data": [
    {
      "id": "clx2xyz789",
      "title": "Office Supplies",
      "description": "Notebooks and pens",
      "amount": "150.7500",
      "type": "EXPENSE",
      "date": "2024-03-15T00:00:00.000Z",
      "categoryId": "clx3cat001",
      "createdById": "clx1abc123",
      "createdAt": "2024-03-15T12:30:00.000Z",
      "updatedAt": "2024-03-15T12:30:00.000Z",
      "deletedAt": null,
      "category": {
        "id": "clx3cat001",
        "name": "Office Supplies",
        "type": "EXPENSE",
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      "createdBy": {
        "id": "clx1abc123",
        "name": "Jane Doe",
        "email": "jane@example.com"
      }
    }
  ]
}
```

---

## Users Endpoints

All users endpoints require authentication and the **ADMIN** role.

### GET /users

Returns a paginated list of all users.

**Authentication:** Required (ADMIN only)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `role` | `VIEWER \| ANALYST \| ADMIN` | — | Filter by role |
| `isActive` | `true \| false` | — | Filter by active status |
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page (max 100) |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Users retrieved.",
  "data": [
    {
      "id": "clx1abc123",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "ANALYST",
      "isActive": true,
      "createdAt": "2024-03-15T12:00:00.000Z",
      "updatedAt": "2024-03-15T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 403 | Admin access required |

---

### GET /users/:id

Returns a single user by ID.

**Authentication:** Required (ADMIN only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | User ID |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "User retrieved.",
  "data": {
    "user": {
      "id": "clx1abc123",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "ANALYST",
      "isActive": true,
      "createdAt": "2024-03-15T12:00:00.000Z",
      "updatedAt": "2024-03-15T12:00:00.000Z"
    }
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 403 | Admin access required |
| 404 | User not found |

---

### PATCH /users/:id/role

Updates a user's role. Admins cannot change their own role.

**Authentication:** Required (ADMIN only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | User ID |

**Request Body:**

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `role` | string | Yes | `VIEWER`, `ANALYST`, `ADMIN` |

```json
{
  "role": "ANALYST"
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "User role updated.",
  "data": {
    "user": {
      "id": "clx1abc123",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "ANALYST",
      "isActive": true,
      "createdAt": "2024-03-15T12:00:00.000Z",
      "updatedAt": "2024-03-16T09:00:00.000Z"
    }
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Cannot change your own role |
| 403 | Admin access required |
| 404 | User not found |

---

### PATCH /users/:id/status

Activates or deactivates a user account. Admins cannot change their own status. Deactivated users cannot log in and existing tokens are immediately rejected.

**Authentication:** Required (ADMIN only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | User ID |

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `isActive` | boolean | Yes |

```json
{
  "isActive": false
}
```

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "User deactivated.",
  "data": {
    "user": {
      "id": "clx1abc123",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "ANALYST",
      "isActive": false,
      "createdAt": "2024-03-15T12:00:00.000Z",
      "updatedAt": "2024-03-16T09:00:00.000Z"
    }
  }
}
```

> `message` is `"User activated."` when `isActive: true`.

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Cannot change your own status |
| 403 | Admin access required |
| 404 | User not found |

---

### DELETE /users/:id

Soft-deletes a user account. Sets `deletedAt` and `isActive = false`. The user record is preserved for audit purposes. Admins cannot delete their own account.

**Authentication:** Required (ADMIN only)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | User ID |

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "User deleted.",
  "data": null
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Cannot delete your own account |
| 403 | Admin access required |
| 404 | User not found |

---

## Categories Endpoints

### GET /categories

Returns all categories (no pagination).

**Authentication:** Required (any role)

**Response — 200 OK:**

```json
{
  "success": true,
  "message": "Categories retrieved.",
  "data": {
    "categories": [
      {
        "id": "clx3cat001",
        "name": "Salaries",
        "type": "INCOME",
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "clx3cat002",
        "name": "Office Supplies",
        "type": "EXPENSE",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### POST /categories

Creates a new category. Category names must be unique.

**Authentication:** Required (ADMIN only)

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 1–100 characters, unique |
| `type` | `INCOME \| EXPENSE` | Yes | |

```json
{
  "name": "Freelance Income",
  "type": "INCOME"
}
```

**Response — 201 Created:**

```json
{
  "success": true,
  "message": "Category created.",
  "data": {
    "category": {
      "id": "clx3cat003",
      "name": "Freelance Income",
      "type": "INCOME",
      "createdAt": "2024-03-15T12:00:00.000Z"
    }
  }
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | Validation failed |
| 403 | Admin access required |
| 409 | Category name already exists |

---

## Quick Start Examples

The following `curl` commands walk through a complete workflow.

### 1. Register a new account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePass123"
  }'
```

### 2. Log in and capture the token

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"SecurePass123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
```

### 3. View your profile

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 4. List available categories

```bash
curl http://localhost:3000/api/v1/categories \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Create a financial record (requires ANALYST or ADMIN role)

```bash
curl -X POST http://localhost:3000/api/v1/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Office Supplies",
    "description": "Notebooks and pens",
    "amount": 150.75,
    "type": "EXPENSE",
    "categoryId": "<category-id-from-step-4>",
    "date": "2024-03-15"
  }'
```

### 6. List records with filters

```bash
curl "http://localhost:3000/api/v1/records?type=EXPENSE&page=1&limit=10&sortBy=date&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

### 7. View dashboard summary (requires ANALYST or ADMIN role)

```bash
curl "http://localhost:3000/api/v1/dashboard/summary?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer $TOKEN"
```

### 8. View income/expense trends

```bash
curl "http://localhost:3000/api/v1/dashboard/trends?period=monthly" \
  -H "Authorization: Bearer $TOKEN"
```

### 9. Admin — promote a user to ANALYST

```bash
curl -X PATCH http://localhost:3000/api/v1/users/<user-id>/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"role": "ANALYST"}'
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | `24h` | JWT token expiry duration |
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | Environment mode (`development` / `production`) |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |

**Example `.env`:**

```env
DATABASE_URL="postgresql://finance_user:finance_pass@localhost:5433/finance_db"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"
PORT=3000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"
```
