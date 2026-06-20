# Database Schema Reference (MySQL 8 / TypeORM)

> This is the precise, source-of-truth schema reference for the project.
> Architecture and design rationale live in `design.md`; this file documents the
> concrete tables, columns, types, keys, and relations as defined by the TypeORM
> entities under `src/`. Keep this file in sync whenever an entity changes.

Naming follows `.agents/references/naming-conventions.md`: tables/columns are
`snake_case`, primary key is `id`, foreign keys are `<table>_id`. Class
properties are `camelCase` and mapped to columns via `@Column({ name: '...' })`.

## Timezone Policy

All `DATETIME` columns (including every `created_at` / `updated_at`) are **stored
as Asia/Bangkok (+07) Thai local time**. The wall-clock value persisted in MySQL
is Thai time, so querying the DB directly shows Thai time.

This is aligned at two layers so the DB value and the API value never skew:

- **App / driver:** TypeORM `mysql` config sets `timezone: '+07:00'`
  (`src/app.module.ts`), so the `mysql2` driver reads/writes `DATETIME` as
  Asia/Bangkok (+07) and maps the stored wall-clock value to the correct instant.
- **MySQL server:** the container runs with `--default-time-zone=+07:00`
  (`docker-compose.yml`), so `CURRENT_TIMESTAMP` used by `@CreateDateColumn` /
  `@UpdateDateColumn` is Thai local time regardless of host TZ. Verify with
  `SELECT @@global.time_zone, @@session.time_zone;` → both `+07:00`.

Because the driver timezone (`+07:00`) matches the server timezone (`+07:00`),
the `Date` returned by the ORM represents the correct instant. NestJS serializes
`Date` via `toISOString()`, so API responses still emit a canonical ISO 8601
instant ending in `Z` (e.g. a record created at Thai `2026-06-20 14:00:00`
serializes as `2026-06-20T07:00:00.000Z`). The frontend converts that instant
back to Asia/Bangkok (+07) for display.

## Entity Relationship Overview

```text
receipt 1 ──< receipt_item                 (OCR receipts)

category 1 ──< product                     (Category group products)
product 1 ──< product_unit                 (POS: one product, many sellable units/barcodes)
product 1 ──1 inventory                     (current stock, in base unit)
product 1 ──< inventory_transaction         (immutable stock ledger: IN / OUT)

user 1 ──< order                           (Cashier process orders)
order 1 ──< order_item                     (Sales details)
order_item >──1 product_unit                (Item sold)

supplier 1 ──< purchase_order              (Vendor for purchasing)
```

---

## POS Domain

### Table `product`

Source: `src/pos/entities/product.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `sku` | VARCHAR | UNIQUE, NOT NULL | Internal stock-keeping unit |
| `name` | VARCHAR | NOT NULL | Display name (Thai allowed) |
| `base_unit_name` | ENUM(`UnitName`) | NOT NULL | Smallest stock unit (multiplier = 1) |
| `cost_price` | DECIMAL(10,2) | DEFAULT 0 | Cost per base unit |
| `category_id` | INT | FK → `category.id`, NULLABLE | Reference to category |
| `published` | BOOLEAN | DEFAULT true | Soft-delete flag (false = deleted) |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

Relations: `OneToMany` → `product_unit` (cascade); `OneToOne` → `inventory` (cascade); `ManyToOne` → `category`.

### Table `product_unit`

Source: `src/pos/entities/product-unit.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `product_id` | INT | FK → `product.id`, ON DELETE CASCADE | |
| `barcode` | VARCHAR | UNIQUE, NOT NULL | Scanned at POS; index for fast lookup |
| `unit_name` | ENUM(`UnitName`) | NOT NULL | e.g. BOTTLE / PACK / CARTON |
| `multiplier` | INT | NOT NULL | How many base units this unit equals |
| `retail_price` | DECIMAL(10,2) | NOT NULL | Price for this unit |
| `wholesale_price` | DECIMAL(10,2) | NOT NULL | Wholesale price for this unit |
| `published` | BOOLEAN | DEFAULT true | Soft-delete flag |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

A single product maps to multiple barcodes/units. All stock math converts a unit
qty to base units using `qty * multiplier`.

On `PUT /pos/product/:id`, units are **upserted by `barcode`**: an existing
barcode is updated in place (preserving `id` / `created_at`, and re-publishing if
it was soft-deleted), a new barcode is inserted, and units not in the payload are
left untouched. Deleting a unit is a **soft delete** (`published = false`) via
`DELETE /pos/unit/:barcode`.

### Table `inventory`

Source: `src/pos/entities/inventory.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `product_id` | INT | **PK**, FK → `product.id`, ON DELETE CASCADE | One row per product |
| `qty_in_base_unit` | INT | DEFAULT 0 | Current stock, always in base unit |

Single source of truth for current stock. Updated under a pessimistic write lock
during `receiveGoods` / `checkout` to prevent race conditions.

### Table `inventory_transaction` (ledger)

Source: `src/pos/entities/inventory-transaction.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `product_id` | INT | FK → `product.id`, ON DELETE CASCADE | |
| `type` | ENUM(`IN`, `OUT`) | NOT NULL | `TransactionType` |
| `qty` | INT | NOT NULL | Quantity in base unit |
| `reference_id` | VARCHAR | NULLABLE | e.g. `RCV-<ts>`, `ORDER-<ts>` |
| `created_at` | DATETIME | auto | |

Append-only audit trail. Every stock movement writes one row so stock changes are
always traceable.

### Enum `UnitName`

Source: `src/pos/enums/unit.enum.ts`

`PIECE`, `SACHET`, `BOTTLE`, `CAN`, `CUP`, `BOX`, `PACK`, `DOZEN`, `CARTON`, `CRATE`

### Table `category`

Source: `src/pos/entities/category.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `name` | VARCHAR | UNIQUE, NOT NULL | e.g. Drinks, Snacks |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

Relations: `OneToMany` → `product`.

---

## Users Domain

### Table `user`

Source: `src/users/entities/user.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `username` | VARCHAR | UNIQUE, NOT NULL | Login name |
| `password_hash` | VARCHAR | NOT NULL | Hashed password |
| `role` | ENUM(`ADMIN`, `CASHIER`) | DEFAULT `CASHIER` | `Role` |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

---

## Sales & Orders Domain

### Table `order`

Source: `src/pos/entities/order.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `order_no` | VARCHAR | UNIQUE, NOT NULL | e.g. INV-20260620-001 |
| `total_amount` | DECIMAL(10,2) | DEFAULT 0 | Sum of items |
| `discount_amount` | DECIMAL(10,2) | DEFAULT 0 | Discount |
| `net_amount` | DECIMAL(10,2) | DEFAULT 0 | Total after discount |
| `payment_method` | ENUM(`CASH`, `PROMPTPAY`) | NOT NULL | `PaymentMethod` |
| `payment_status` | ENUM(`PENDING`, `COMPLETED`, `CANCELLED`) | DEFAULT `PENDING` | `OrderStatus` |
| `cashier_id` | INT | FK → `user.id`, NULLABLE | Cashier who processed the order |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

Relations: `OneToMany` → `order_item` (cascade); `ManyToOne` → `user`.

### Table `order_item`

Source: `src/pos/entities/order-item.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `order_id` | INT | FK → `order.id`, ON DELETE CASCADE | |
| `product_unit_id` | INT | FK → `product_unit.id` | The specific unit sold |
| `qty` | INT | NOT NULL | |
| `unit_price` | DECIMAL(10,2) | DEFAULT 0 | Snapshot of unit price |
| `subtotal` | DECIMAL(10,2) | DEFAULT 0 | qty * unit_price |

Relations: `ManyToOne` → `order`; `ManyToOne` → `product_unit`.

---

## Purchase & Supplier Domain

### Table `supplier`

Source: `src/pos/entities/supplier.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `name` | VARCHAR | NOT NULL | Supplier / vendor name |
| `contact_info` | VARCHAR | NULLABLE | Details |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

### Table `purchase_order`

Source: `src/pos/entities/purchase-order.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `po_no` | VARCHAR | UNIQUE, NOT NULL | Purchase document number |
| `supplier_id` | INT | FK → `supplier.id`, NULLABLE | |
| `total_amount` | DECIMAL(10,2) | DEFAULT 0 | |
| `status` | ENUM(`PENDING`, `COMPLETED`, `CANCELLED`) | DEFAULT `PENDING` | `PurchaseOrderStatus` |
| `created_at` | DATETIME(6) | auto | |
| `updated_at` | DATETIME(6) | auto | |

Relations: `ManyToOne` → `supplier`.

---

## Receipt (OCR) Domain

### Table `receipt`

Source: `src/receipt/receipt.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | CHAR(36) UUID | PK | Generated UUID |
| `user_id` | VARCHAR | NOT NULL | LINE user id |
| `store_name` | VARCHAR | NOT NULL | |
| `date` | VARCHAR(50) | NULLABLE | Raw receipt date string |
| `total_amount` | DECIMAL(10,2) | DEFAULT 0.00 | |
| `status` | ENUM(`pending`,`approved`,`cancelled`) | DEFAULT `pending` | `ReceiptStatus` |
| `created_at` | DATETIME | auto | |
| `updated_at` | DATETIME | auto | |

Relations: `OneToMany` → `receipt_item` (cascade, eager).

### Table `receipt_item`

Source: `src/receipt/receipt-item.entity.ts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, auto-increment | |
| `name` | VARCHAR | NOT NULL | |
| `quantity` | INT | DEFAULT 1 | |
| `price` | DECIMAL(10,2) | DEFAULT 0.00 | |
| `receipt_id` | CHAR(36) | FK → `receipt.id`, ON DELETE CASCADE | |

### Enum `ReceiptStatus`

Source: `src/receipt/receipt.entity.ts` — `pending`, `approved`, `cancelled`.
