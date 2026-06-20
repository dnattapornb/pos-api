# POS REST API Reference

> Manual read/test reference for every POS, Order, and User endpoint.
> Source of truth: `src/pos/pos.controller.ts`, `src/users/users.controller.ts`, DTOs in `src/pos/dto/pos.dto.ts` and `src/users/dto/*`.
> Schema details: `.agents/specs/database.md`. Runnable client: `http/pos.http`.

## Base

- Base URL: `http://localhost:${PORT}` (default `PORT=3000`)
- POS endpoints are prefixed with `/pos`. User endpoints are at the root (`/user`, `/users`).
- Content type for POST/PUT: `application/json`.
- Global `ValidationPipe` is enabled with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
  - Unknown fields in the body → **400 Bad Request**.
  - Type/rule violations → **400 Bad Request** with a `message[]` array describing each failure.
- `:id` params use `ParseIntPipe` → **400** if not an integer.
- **Timezone:** `DATETIME` columns are stored as Asia/Bangkok (+07) Thai local time (MySQL `--default-time-zone=+07:00`, TypeORM driver `timezone: '+07:00'`). `createdAt` / `updatedAt` in responses are serialized by NestJS via `toISOString()`, so they are canonical ISO 8601 instant strings ending in `Z` (e.g. a record created at Thai `2026-06-20 14:00:00` returns `2026-06-20T07:00:00.000Z`). The client converts that instant to Asia/Bangkok (+07) for display. See the Timezone Policy in `.agents/specs/database.md`.

Set a shell variable to reuse:

```bash
BASE="http://localhost:3000"
```

### Enums

- `UnitName`: `PIECE`, `SACHET`, `BOTTLE`, `CAN`, `CUP`, `BOX`, `PACK`, `DOZEN`, `CARTON`, `CRATE`.
- `PaymentMethod`: `CASH`, `PROMPTPAY`.
- `OrderStatus`: `PENDING`, `COMPLETED`, `CANCELLED`.
- `Role`: `ADMIN`, `CASHIER`.

---

## Endpoint Summary

| Method | Path | Purpose | Body DTO |
|---|---|---|---|
| GET | `/pos/categories` | List all categories | — |
| GET | `/pos/category/:id` | Get one category by id | — |
| POST | `/pos/category` | Create a category | `CreateCategoryDto` |
| PUT | `/pos/category/:id` | Update a category | `UpdateCategoryDto` |
| DELETE | `/pos/category/:id` | Delete a category (blocked if it has products) | — |
| GET | `/pos/products` | List all published products (with units + inventory) | — |
| GET | `/pos/product/:id` | Get one product by id | — |
| POST | `/pos/product` | Create a product with units | `CreateProductDto` |
| PUT | `/pos/product/:id` | Update a product (partial, upsert units by barcode) | `UpdateProductDto` |
| DELETE | `/pos/product/:id` | Soft-delete a product | — |
| GET | `/pos/product/unit/:id` | Get one product unit by id | — |
| POST | `/pos/product/unit` | Create a product unit (`productId` in body) | `AddProductUnitDto` |
| PUT | `/pos/product/unit/:id` | Update a product unit by id | `UpdateProductUnitDto` |
| DELETE | `/pos/product/unit/:id` | Soft-delete a single product unit by id | — |
| GET | `/pos/suppliers` | List all suppliers | — |
| GET | `/pos/supplier/:id` | Get one supplier by id | — |
| POST | `/pos/supplier` | Create a supplier | `CreateSupplierDto` |
| PUT | `/pos/supplier/:id` | Update a supplier | `UpdateSupplierDto` |
| DELETE | `/pos/supplier/:id` | Delete a supplier | — |
| POST | `/pos/purchase-order` | Receive stock (creates PO + IN ledger) | `CreatePurchaseOrderDto` |
| POST | `/pos/checkout` | Sale: creates Order + OrderItems, deducts stock | `CheckoutDto` |
| GET | `/pos/orders` | List all orders (newest first, with items) | — |
| GET | `/pos/order/:id` | Get one order (items + product + cashier) | — |
| POST | `/pos/seed` | Wipe + seed 5 sample products | — |
| GET | `/users` | List all users | — |
| GET | `/user/:id` | Get one user by id | — |
| POST | `/user` | Create a user | `CreateUserDto` |
| PUT | `/user/:id` | Update a user (partial) | `UpdateUserDto` |

---

## Categories

A `Category` groups products. `name` is unique. A product references at most one category via `categoryId`.

### List categories

`GET /pos/categories`

```bash
curl -s "$BASE/pos/categories"
```

### Get category by id

`GET /pos/category/:id` — unknown id → **400** `"Category not found"`.

### Create category

`POST /pos/category` — body `CreateCategoryDto`.

| Field | Rule |
|---|---|
| `name` | string, not empty (unique) |

```bash
curl -s -X POST "$BASE/pos/category" \
  -H "Content-Type: application/json" \
  -d '{ "name": "เครื่องดื่ม" }'
```

Duplicate name → **400** `"Failed to create category (name might already exist)"`.

### Update category

`PUT /pos/category/:id` — body `UpdateCategoryDto` (`name?` optional).

```bash
curl -s -X PUT "$BASE/pos/category/1" \
  -H "Content-Type: application/json" \
  -d '{ "name": "เครื่องดื่ม & น้ำ" }'
```

### Delete category

`DELETE /pos/category/:id` — hard delete. Blocked with **400** `"Cannot delete category with products"` if any product still references it.

```json
{ "message": "Category 1 has been deleted" }
```

---

## Products

### List products

`GET /pos/products` — returns only `published: true` products, each with `units` and `inventory`.

```json
[
  {
    "id": 1,
    "sku": "SKU-001",
    "name": "น้ำอัดลม 325 มล.",
    "baseUnitName": "BOTTLE",
    "costPrice": "12.00",
    "published": true,
    "createdAt": "2026-06-20T07:00:00.000Z",
    "updatedAt": "2026-06-20T07:00:00.000Z",
    "units": [
      { "id": 1, "barcode": "8850001", "unitName": "BOTTLE", "multiplier": 1, "retailPrice": "15.00", "wholesalePrice": "14.00", "published": true }
    ],
    "inventory": { "productId": 1, "qtyInBaseUnit": 48 }
  }
]
```

### Get product by id

`GET /pos/product/:id` — returns the product with `units`, `inventory`, and `category`. Missing/unpublished → **400** `"Product not found"`.

### Create product

`POST /pos/product` — body `CreateProductDto`.

| Field | Rule |
|---|---|
| `sku` | string, not empty |
| `name` | string, not empty |
| `baseUnitName` | one of `UnitName` |
| `costPrice` | number ≥ 0, ≤ 2 decimal places |
| `categoryId` | optional number, positive (must exist) |
| `units` | array, at least 1 item |
| `units[].barcode` | string, not empty |
| `units[].unitName` | one of `UnitName` |
| `units[].multiplier` | number, positive |
| `units[].retailPrice` | number ≥ 0, ≤ 2 decimal places |
| `units[].wholesalePrice` | number ≥ 0, ≤ 2 decimal places |

```bash
curl -s -X POST "$BASE/pos/product" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU-100",
    "name": "ขนมปังโฮลวีท",
    "baseUnitName": "PIECE",
    "costPrice": 18.5,
    "categoryId": 1,
    "units": [
      { "barcode": "8851000", "unitName": "PIECE", "multiplier": 1, "retailPrice": 25, "wholesalePrice": 22 },
      { "barcode": "8851001", "unitName": "PACK", "multiplier": 6, "retailPrice": 140, "wholesalePrice": 130 }
    ]
  }'
```

Creates the product, its units, and an `inventory` row with `qtyInBaseUnit: 0` (all in one transaction). Unknown `categoryId` → **400** `"Category not found"`. Returns the created product (same shape as `GET /pos/product/:id`).

### Update product

`PUT /pos/product/:id` — body `UpdateProductDto`. All fields optional; when present, the same rules as create apply. Adds `categoryId?` and `published?: boolean`.

> **Units are upserted by `barcode`** (not wiped and recreated):
> - A unit whose `barcode` already exists is **updated in place** — its `id`/`createdAt` are preserved. A previously soft-deleted unit is **re-published**.
> - A unit with a new `barcode` is **created**.
> - Existing units not in the payload are **left untouched**. To remove a unit, use `DELETE /pos/product/unit/:id`.
>
> `categoryId` reassigns the product's category (must exist). `published` toggles visibility.

```bash
# Update name and price only
curl -s -X PUT "$BASE/pos/product/1" \
  -H "Content-Type: application/json" \
  -d '{ "name": "น้ำอัดลม (สูตรใหม่)", "costPrice": 13 }'

# Assign / change category
curl -s -X PUT "$BASE/pos/product/1" \
  -H "Content-Type: application/json" \
  -d '{ "categoryId": 2 }'

# Upsert one unit; others left as-is
curl -s -X PUT "$BASE/pos/product/1" \
  -H "Content-Type: application/json" \
  -d '{ "units": [ { "barcode": "8850001", "unitName": "BOTTLE", "multiplier": 1, "retailPrice": 16, "wholesalePrice": 15 } ] }'
```

### Delete product (soft delete)

`DELETE /pos/product/:id` — sets `published = false` on the product and its units. Data is retained.

```json
{ "message": "Product 1 has been deleted" }
```

---

## Product units

Manage a single `product_unit` independently of the product upsert flow. For `GET`/`PUT`/`DELETE` the `:id` is the **`product_unit.id`**. For `POST` the parent product is referenced via `productId` in the **body**.

> `barcode` is unique across the whole `product_unit` table. A duplicate `barcode` on create/update throws from the DB.

### Get product unit by id

`GET /pos/product/unit/:id` — returns only a `published: true` unit including its `product`. Unknown/unpublished → **400** `"Product unit not found"`.

### Create product unit

`POST /pos/product/unit` — body `AddProductUnitDto` (unit fields plus `productId`). Product must exist (else **400** `"Product not found"`).

| Field | Rule |
|---|---|
| `productId` | number, positive (must exist) |
| `barcode` | string, not empty |
| `unitName` | one of `UnitName` |
| `multiplier` | number, positive |
| `retailPrice` | number ≥ 0, ≤ 2 decimal places |
| `wholesalePrice` | number ≥ 0, ≤ 2 decimal places |

### Update product unit

`PUT /pos/product/unit/:id` — body `UpdateProductUnitDto`. All fields optional (`barcode`, `unitName`, `multiplier`, `retailPrice`, `wholesalePrice`, `published`); only provided fields change. Unknown id → **400** `"Product unit not found"`.

### Delete product unit (soft delete)

`DELETE /pos/product/unit/:id` — sets `published = false`. The row is retained, so the same `barcode` re-publishes automatically if sent again via `PUT /pos/product/:id`.

```json
{ "message": "Product unit 1 has been deleted" }
```

---

## Suppliers

A `Supplier` is the vendor referenced by a purchase order.

### List / get

`GET /pos/suppliers` — all suppliers. `GET /pos/supplier/:id` — one supplier; unknown id → **400** `"Supplier not found"`.

### Create supplier

`POST /pos/supplier` — body `CreateSupplierDto`.

| Field | Rule |
|---|---|
| `name` | string, not empty |
| `contactInfo` | optional string |

```bash
curl -s -X POST "$BASE/pos/supplier" \
  -H "Content-Type: application/json" \
  -d '{ "name": "บริษัท เครื่องดื่มไทย จำกัด", "contactInfo": "02-123-4567" }'
```

### Update supplier

`PUT /pos/supplier/:id` — body `UpdateSupplierDto` (`name?`, `contactInfo?`).

### Delete supplier

`DELETE /pos/supplier/:id` — hard delete.

```json
{ "message": "Supplier 1 has been deleted" }
```

---

## Purchase orders (stock IN)

`POST /pos/purchase-order` — body `CreatePurchaseOrderDto`. Replaces the old `/pos/inventory/receive` flow. In one transaction it:

1. Creates a `PurchaseOrder` (`poNo = PO-<timestamp>`, `status = COMPLETED`).
2. For each item: resolves the barcode, converts `qty * multiplier` to base units, adds to inventory under a write lock, and writes an `IN` ledger row (`reference_id = PO-<timestamp>`).
3. Accumulates `totalAmount` using the per-item `costPrice` when given, otherwise the product's `costPrice`.

| Field | Rule |
|---|---|
| `supplierId` | optional number, positive (must exist) |
| `items` | array, at least 1 item |
| `items[].barcode` | string, not empty (must exist in `product_unit`) |
| `items[].qty` | number, positive |
| `items[].costPrice` | optional number ≥ 0 (defaults to product's `costPrice`) |

```bash
curl -s -X POST "$BASE/pos/purchase-order" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": 1,
    "items": [
      { "barcode": "8850003", "qty": 2, "costPrice": 11.5 },
      { "barcode": "8850006", "qty": 1 }
    ]
  }'
```

```json
{ "message": "Purchase order created successfully", "poNo": "PO-1750500000000" }
```

Unknown `supplierId` → **400** `"Supplier not found"`. Unknown barcode → **400** `"Barcode <barcode> not found"`. Any failure rolls back the entire PO.

---

## Orders & Checkout (stock OUT)

### Checkout

`POST /pos/checkout` — body `CheckoutDto`. Runs in a single transaction:

1. Creates the `Order` header (`orderNo = referenceId` or `ORDER-<timestamp>`, `paymentStatus = COMPLETED`).
2. For each item: resolves the barcode, locks the inventory row, verifies sufficient stock, deducts `qty * multiplier`, creates an `OrderItem` (`unitPrice = retailPrice`, `subtotal = unitPrice * qty`), and writes an `OUT` ledger row.
3. Finalizes totals: `totalAmount = Σ subtotal`, `netAmount = totalAmount - discountAmount`.

| Field | Rule |
|---|---|
| `items` | array, at least 1 item |
| `items[].barcode` | string, not empty |
| `items[].qty` | number, positive |
| `paymentMethod` | optional `PaymentMethod` (defaults to `CASH`) |
| `discountAmount` | optional number ≥ 0, ≤ 2 decimal places (defaults to `0`) |
| `cashierId` | optional number, positive |
| `referenceId` | optional string, not empty when present (defaults to `ORDER-<timestamp>`) |

```bash
curl -s -X POST "$BASE/pos/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "barcode": "8850001", "qty": 3 },
      { "barcode": "8850004", "qty": 5 }
    ],
    "paymentMethod": "CASH",
    "discountAmount": 10,
    "cashierId": 1,
    "referenceId": "POS-TERMINAL-1-0001"
  }'
```

On success returns the created `Order` (same shape as `GET /pos/order/:id`).

- Unknown barcode → **400** `"Barcode <barcode> not found"`.
- Insufficient stock → **400** `"Insufficient stock for product <name> (Barcode: <barcode>)"`.
- `discountAmount` greater than total → **400** `"Discount amount cannot exceed total amount"`.

Any failure rolls back the entire order.

### List orders

`GET /pos/orders` — all orders, newest first, each with its `items`.

### Get order by id

`GET /pos/order/:id` — one order with `items` (including `productUnit.product`) and `cashier`. Unknown id → **400** `"Order not found"`.

```json
{
  "id": 1,
  "orderNo": "POS-TERMINAL-1-0001",
  "totalAmount": "80.00",
  "discountAmount": "10.00",
  "netAmount": "70.00",
  "paymentMethod": "CASH",
  "paymentStatus": "COMPLETED",
  "cashierId": 1,
  "createdAt": "2026-06-21T07:00:00.000Z",
  "updatedAt": "2026-06-21T07:00:00.000Z",
  "items": [
    {
      "id": 1,
      "orderId": 1,
      "productUnitId": 1,
      "qty": 3,
      "unitPrice": "15.00",
      "subtotal": "45.00",
      "productUnit": { "id": 1, "barcode": "8850001", "product": { "id": 1, "name": "น้ำอัดลม 325 มล." } }
    }
  ],
  "cashier": { "id": 1, "username": "cashier01", "role": "CASHIER" }
}
```

### Seed sample data

`POST /pos/seed` — **destructive**: truncates `product`, `product_unit`, `inventory`, `inventory_transaction`, then inserts 5 sample products with stock. Dev only.

```json
{ "message": "Products seeded successfully" }
```

---

## Users

Auth/staff accounts. The `passwordHash` column is **never** returned — the controller maps every user through `UserResponseDto` (`id`, `username`, `role`, `createdAt`, `updatedAt`).

### List / get

`GET /users` — all users. `GET /user/:id` — one user; unknown id → **400** (service throws).

### Create user

`POST /user` — body `CreateUserDto`. The plaintext `password` is hashed before storage.

| Field | Rule |
|---|---|
| `username` | string, not empty |
| `password` | string, not empty, min length 6 |
| `role` | optional `Role` (`ADMIN` / `CASHIER`) |

```bash
curl -s -X POST "$BASE/user" \
  -H "Content-Type: application/json" \
  -d '{ "username": "cashier01", "password": "secret123", "role": "CASHIER" }'
```

```json
{
  "id": 1,
  "username": "cashier01",
  "role": "CASHIER",
  "createdAt": "2026-06-21T07:00:00.000Z",
  "updatedAt": "2026-06-21T07:00:00.000Z"
}
```

Password shorter than 6 chars → **400**.

### Update user

`PUT /user/:id` — body `UpdateUserDto`. All fields optional (`username?`, `password?` min length 6, `role?`); a new `password` is re-hashed. Returns the mapped user.

```bash
curl -s -X PUT "$BASE/user/1" \
  -H "Content-Type: application/json" \
  -d '{ "role": "ADMIN" }'
```

---

## Quick smoke-test flow

```bash
BASE="http://localhost:3000"

curl -s -X POST "$BASE/pos/seed"                       # 1. seed sample data
curl -s "$BASE/pos/products"                           # 2. list products
curl -s -X POST "$BASE/pos/purchase-order" \           # 3. add stock
  -H "Content-Type: application/json" \
  -d '{ "items": [{ "barcode": "8850007", "qty": 1 }] }'
curl -s -X POST "$BASE/pos/checkout" \                 # 4. sell
  -H "Content-Type: application/json" \
  -d '{ "items": [{ "barcode": "8850001", "qty": 1 }] }'
curl -s "$BASE/pos/orders"                             # 5. review orders
curl -s "$BASE/pos/product/1"                          # 6. verify stock changed
```
