# POS REST API Reference — Product & Inventory

> Manual read/test reference for every Product and Inventory endpoint.
> Source of truth: `src/pos/pos.controller.ts`, DTOs in `src/pos/dto/pos.dto.ts`.
> Schema details: `.agents/specs/database.md`.

## Base

- Base URL: `http://localhost:${PORT}` (default `PORT=3000`)
- All endpoints below are prefixed with `/pos`.
- Content type for POST/PUT: `application/json`.
- Global `ValidationPipe` is enabled with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
  - Unknown fields in the body → **400 Bad Request**.
  - Type/rule violations → **400 Bad Request** with a `message[]` array describing each failure.
- **Timezone:** `DATETIME` columns are stored as Asia/Bangkok (+07) Thai local time (MySQL `--default-time-zone=+07:00`, TypeORM driver `timezone: '+07:00'`). `createdAt` / `updatedAt` in responses are serialized by NestJS via `toISOString()`, so they are canonical ISO 8601 instant strings ending in `Z` (e.g. a record created at Thai `2026-06-20 14:00:00` returns `2026-06-20T07:00:00.000Z`). The client converts that instant to Asia/Bangkok (+07) for display. See the Timezone Policy in `.agents/specs/database.md`.

Set a shell variable to reuse:

```bash
BASE="http://localhost:3000"
```

---

## Endpoint Summary

| Method | Path | Purpose | Body DTO |
|---|---|---|---|
| GET | `/pos/products` | List all published products (with units + inventory) | — |
| GET | `/pos/product/:id` | Get one product by id | — |
| POST | `/pos/product` | Create a product with units | `CreateProductDto` |
| PUT | `/pos/product/:id` | Update a product (partial, upsert units by barcode) | `UpdateProductDto` |
| DELETE | `/pos/product/:id` | Soft-delete a product | — |
| GET | `/pos/product/unit/:id` | Get one product unit by id | — |
| POST | `/pos/product/unit` | Create a product unit (`productId` in body) | `AddProductUnitDto` |
| PUT | `/pos/product/unit/:id` | Update a product unit by id | `UpdateProductUnitDto` |
| DELETE | `/pos/product/unit/:id` | Soft-delete a single product unit by id | — |
| POST | `/pos/seed` | Wipe + seed 5 sample products | — |
| POST | `/pos/inventory/receive` | Receive stock by barcode | `ReceiveGoodsDto` |
| POST | `/pos/checkout` | Deduct stock for a sale | `CheckoutDto` |

---

## Products

### List products

`GET /pos/products` — returns only `published: true` products, each with `units` and `inventory`.

```bash
curl -s "$BASE/pos/products"
```

Example response:

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

`GET /pos/product/:id` — `id` must be an integer (`ParseIntPipe`). Returns **400** if not numeric, throws not-found if missing/unpublished.

```bash
curl -s "$BASE/pos/product/1"
```

### Create product

`POST /pos/product` — body `CreateProductDto`.

Validation rules:

| Field | Rule |
|---|---|
| `sku` | string, not empty |
| `name` | string, not empty |
| `baseUnitName` | one of `UnitName` enum |
| `costPrice` | number ≥ 0, ≤ 2 decimal places |
| `units` | array, at least 1 item |
| `units[].barcode` | string, not empty |
| `units[].unitName` | one of `UnitName` enum |
| `units[].multiplier` | number, positive |
| `units[].retailPrice` | number ≥ 0, ≤ 2 decimal places |
| `units[].wholesalePrice` | number ≥ 0, ≤ 2 decimal places |

`UnitName` values: `PIECE`, `SACHET`, `BOTTLE`, `CAN`, `CUP`, `BOX`, `PACK`, `DOZEN`, `CARTON`, `CRATE`.

```bash
curl -s -X POST "$BASE/pos/product" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU-100",
    "name": "ขนมปังโฮลวีท",
    "baseUnitName": "PIECE",
    "costPrice": 18.5,
    "units": [
      { "barcode": "8851000", "unitName": "PIECE", "multiplier": 1, "retailPrice": 25, "wholesalePrice": 22 },
      { "barcode": "8851001", "unitName": "PACK", "multiplier": 6, "retailPrice": 140, "wholesalePrice": 130 }
    ]
  }'
```

On success returns the created product (same shape as `GET /pos/product/:id`). Creates an `inventory` row with `qtyInBaseUnit: 0`.

Example **400** (invalid enum + empty units):

```json
{
  "statusCode": 400,
  "message": [
    "baseUnitName must be one of the following values: PIECE, SACHET, BOTTLE, CAN, CUP, BOX, PACK, DOZEN, CARTON, CRATE",
    "units must contain at least 1 elements"
  ],
  "error": "Bad Request"
}
```

### Update product

`PUT /pos/product/:id` — body `UpdateProductDto`. All fields optional, but when present must pass the same rules as create. Adds `published?: boolean`.

> **Units are upserted by `barcode`** (not wiped and recreated):
> - A unit whose `barcode` already exists on the product is **updated in place** — its `id` and `createdAt` are preserved. If it was previously soft-deleted, it is **re-published** (`published = true`).
> - A unit with a new `barcode` is **created**.
> - Existing units that are **not** in the payload are **left untouched** (not deleted). To remove a unit, use `DELETE /pos/product/unit/:id`.

```bash
# Update name and price only
curl -s -X PUT "$BASE/pos/product/1" \
  -H "Content-Type: application/json" \
  -d '{ "name": "น้ำอัดลม (สูตรใหม่)", "costPrice": 13 }'

# Upsert units: 8850001 is updated in place, a new barcode is created,
# any other existing unit is left as-is
curl -s -X PUT "$BASE/pos/product/1" \
  -H "Content-Type: application/json" \
  -d '{
    "units": [
      { "barcode": "8850001", "unitName": "BOTTLE", "multiplier": 1, "retailPrice": 16, "wholesalePrice": 15 }
    ]
  }'

# Republish / unpublish
curl -s -X PUT "$BASE/pos/product/1" \
  -H "Content-Type: application/json" \
  -d '{ "published": true }'
```

### Delete product (soft delete)

`DELETE /pos/product/:id` — sets `published = false` on the product and its units. Data is retained.

```bash
curl -s -X DELETE "$BASE/pos/product/1"
```

Response:

```json
{ "message": "Product 1 has been deleted" }
```

---

## Product units

Manage a single `product_unit` independently of the product upsert flow. For `GET`, `PUT`, and `DELETE` the `:id` is the **`product_unit.id`** (integer, `ParseIntPipe` → **400** if not numeric). For `POST` (create) the unit has no id yet, so the parent product is referenced via `productId` in the **body**.

> A `barcode` is unique across the whole `product_unit` table. Sending a duplicate `barcode` on create/update throws from the DB.

### Get product unit by id

`GET /pos/product/unit/:id` — returns only a `published: true` unit, including its `product` relation. Unknown/unpublished id → **400** `"Product unit not found"`.

```bash
curl -s "$BASE/pos/product/unit/1"
```

### Create product unit

`POST /pos/product/unit` — body `AddProductUnitDto` (the unit fields plus `productId`). The product must exist (else **400** `"Product not found"`).

| Field | Rule |
|---|---|
| `productId` | number, positive (must exist in `product`) |
| `barcode` | string, not empty |
| `unitName` | one of `UnitName` enum |
| `multiplier` | number, positive |
| `retailPrice` | number ≥ 0, ≤ 2 decimal places |
| `wholesalePrice` | number ≥ 0, ≤ 2 decimal places |

```bash
curl -s -X POST "$BASE/pos/product/unit" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "barcode": "8850099",
    "unitName": "PACK",
    "multiplier": 6,
    "retailPrice": 85,
    "wholesalePrice": 80
  }'
```

On success returns the created unit (with its `product`).

### Update product unit

`PUT /pos/product/unit/:id` — body `UpdateProductUnitDto`. All fields optional (`barcode`, `unitName`, `multiplier`, `retailPrice`, `wholesalePrice`, `published`); only provided fields are changed. Unknown id → **400** `"Product unit not found"`.

```bash
curl -s -X PUT "$BASE/pos/product/unit/1" \
  -H "Content-Type: application/json" \
  -d '{ "retailPrice": 16, "wholesalePrice": 15 }'
```

### Delete product unit (soft delete)

`DELETE /pos/product/unit/:id` — sets `published = false` on the `product_unit` matched by `id`. The row is retained, so the same `barcode` is re-published automatically if it is sent again via `PUT /pos/product/:id`. Unknown id → **400** `"Product unit not found"`.

```bash
curl -s -X DELETE "$BASE/pos/product/unit/1"
```

Response:

```json
{ "message": "Product unit 1 has been deleted" }
```

### Seed sample data

`POST /pos/seed` — **destructive**: truncates `product`, `product_unit`, `inventory`, `inventory_transaction`, then inserts 5 sample products with stock. Use only in dev.

```bash
curl -s -X POST "$BASE/pos/seed"
```

```json
{ "message": "Products seeded successfully" }
```

---

## Inventory

### Receive goods (stock IN)

`POST /pos/inventory/receive` — body `ReceiveGoodsDto`. Looks up the barcode, converts `qty * multiplier` to base units, adds to inventory under a write lock, and writes an `IN` ledger row (`reference_id = RCV-<timestamp>`).

| Field | Rule |
|---|---|
| `barcode` | string, not empty (must exist in `product_unit`) |
| `qty` | number, positive |

```bash
# Receive 2 cartons (multiplier 24) of barcode 8850003 -> +48 base units
curl -s -X POST "$BASE/pos/inventory/receive" \
  -H "Content-Type: application/json" \
  -d '{ "barcode": "8850003", "qty": 2 }'
```

```json
{ "message": "Goods received successfully", "qtyAdded": 48, "unitName": "BOTTLE" }
```

Unknown barcode → **400** `"Barcode not found"`.

### Checkout (stock OUT)

`POST /pos/checkout` — body `CheckoutDto`. For each item: resolves the barcode, locks the inventory row, verifies sufficient stock, deducts `qty * multiplier`, and writes an `OUT` ledger row. The whole order runs in one transaction — any insufficient-stock item rolls back the entire checkout.

| Field | Rule |
|---|---|
| `items` | array, at least 1 item |
| `items[].barcode` | string, not empty |
| `items[].qty` | number, positive |
| `referenceId` | optional string, not empty when present (defaults to `ORDER-<timestamp>`) |

```bash
curl -s -X POST "$BASE/pos/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "barcode": "8850001", "qty": 3 },
      { "barcode": "8850004", "qty": 5 }
    ],
    "referenceId": "POS-TERMINAL-1-0001"
  }'
```

```json
{ "message": "Checkout successful", "referenceId": "POS-TERMINAL-1-0001" }
```

Insufficient stock → **400** `"Insufficient stock for product <name> (Barcode: <barcode>)"` and the whole order is rolled back.

---

## Quick smoke-test flow

```bash
BASE="http://localhost:3000"

curl -s -X POST "$BASE/pos/seed"                 # 1. seed sample data
curl -s "$BASE/pos/products"                     # 2. list products
curl -s -X POST "$BASE/pos/inventory/receive" \  # 3. add stock
  -H "Content-Type: application/json" \
  -d '{ "barcode": "8850007", "qty": 1 }'
curl -s -X POST "$BASE/pos/checkout" \           # 4. sell
  -H "Content-Type: application/json" \
  -d '{ "items": [{ "barcode": "8850001", "qty": 1 }] }'
curl -s "$BASE/pos/product/1"                     # 5. verify stock changed
```
