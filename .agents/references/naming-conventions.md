# Naming Conventions

This document outlines the standard naming conventions used in this project. All new code and database schemas MUST follow these global best practices to ensure consistency.

## 1. MySQL Database Naming Conventions

We follow standard relational database naming conventions using `snake_case`.

- **Tables:** `snake_case`, singular form (e.g., `receipt`, `receipt_item`, `user`).
- **Columns:** `snake_case` (e.g., `store_name`, `total_amount`, `created_at`).
- **Primary Keys:** Always named `id`.
- **Foreign Keys:** `<referenced_table_singular>_id` (e.g., `receipt_id`, `user_id`).
- **Indexes/Constraints:**
  - Primary Key: `pk_<table>`
  - Foreign Key: `fk_<table>_<referenced_table>`
  - Unique: `uq_<table>_<column>`

*When using TypeORM, ensure you map camelCase class properties to snake_case column names using the `@Column({ name: 'store_name' })` decorator, or use a naming strategy.*

## 2. NestJS Naming Conventions

We strictly follow the official NestJS style guide.
Reference: [NestJS Official Documentation](https://docs.nestjs.com/)

- **Files and Folders:** `kebab-case` with dot-separated suffixes.
  - Controllers: `receipt.controller.ts`
  - Services: `receipt.service.ts`
  - Modules: `receipt.module.ts`
  - Entities (TypeORM): `receipt.entity.ts`
  - Interfaces: `receipt.interface.ts`
  - DTOs: `create-receipt.dto.ts`
- **Classes:** `PascalCase`.
  - e.g., `ReceiptController`, `OcrService`
- **Methods and Variables:** `camelCase`.
  - e.g., `getReceiptById`, `totalAmount`
- **Constants and Enums:** `UPPER_SNAKE_CASE` or `PascalCase` for Enum names.
  - e.g., `export const MAX_RETRY_COUNT = 3;`
  - e.g., `export enum ReceiptStatus { PENDING = 'pending', APPROVED = 'approved' }`

## 3. REST API URL Path Conventions (Plural vs Singular)

Endpoint paths MUST signal cardinality through the resource noun: use the **plural** noun for collection operations and the **singular** noun for single-resource operations. The `:id` segment always follows the singular noun.

| Method | Path shape | Operation | Form |
|---|---|---|---|
| `GET` | `/<resource-plural>` | Get all (list collection) | **Plural** |
| `GET` | `/<resource-singular>/:id` | Get one by id | **Singular** |
| `POST` | `/<resource-singular>` | Create one | **Singular** |
| `PUT` | `/<resource-singular>/:id` | Update one by id | **Singular** |
| `DELETE` | `/<resource-singular>/:id` | Delete one by id | **Singular** |

Canonical example (Product, prefixed with the `pos` controller scope):

```text
GET    /pos/products       # get all products       -> plural
GET    /pos/product/:id    # get one product by id  -> singular
POST   /pos/product        # create one product     -> singular
PUT    /pos/product/:id    # update one product     -> singular
DELETE /pos/product/:id    # delete one product     -> singular
```

Rules:
- Resource nouns in the path are `kebab-case` and lowercase (e.g. `purchase-order`, `product/unit`).
- The **only** plural path is the "get all" collection endpoint; every single-resource verb uses the singular noun.
- Nested single resources repeat the pattern on the child noun (e.g. `GET /pos/product/unit/:id`, `POST /pos/product/unit`).
- When a controller has no shared prefix, declare `@Controller()` with no argument and put the full plural/singular path on each handler, rather than forcing a single plural `@Controller('<plural>')` prefix onto singular operations.

## 4. General TypeScript Practices
- **Interfaces:** `PascalCase`. Do NOT use the `I` prefix (e.g., use `ReceiptData`, not `IReceiptData`).
- **Booleans:** Prefix with `is`, `has`, `can`, or `should` (e.g., `isValid`, `hasItems`).
