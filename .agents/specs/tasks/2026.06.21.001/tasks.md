# Phase: Add POS Sales, Categorization, and User Entities

**Goal:** ขยายโครงสร้างฐานข้อมูล (Database Schema) เพื่อรองรับระบบหน้าร้านและการขาย (Sales & Orders), หมวดหมู่สินค้า (Categorization), ผู้ใช้งาน (Users) และระบบจัดซื้อ (Supplier/PO) ตามที่ได้วางแผนไว้ โดยใช้ TypeORM Entities

**Affected files:** `src/pos/entities/*`, `src/users/entities/*`, `.agents/specs/database.md`

## R1.1 — Categorization (หมวดหมู่สินค้า)

- [x] สร้างไฟล์ `src/pos/entities/category.entity.ts` (ประกอบด้วย `id`, `name`, `created_at`, `updated_at`)
- [x] แก้ไขไฟล์ `src/pos/entities/product.entity.ts` เพื่อเพิ่ม `categoryId` (mapped to `category_id`, NULLABLE) และกำหนด ManyToOne relation เชื่อมกับ `Category`

## R1.2 — Users (ผู้ใช้งาน)

- [x] สร้างไฟล์ `src/users/entities/user.entity.ts` (ประกอบด้วย `id`, `username`, `password_hash`, `role` [ADMIN, CASHIER], `created_at`, `updated_at`)

## R1.3 — Sales & Orders (ระบบการขาย)

- [x] สร้างไฟล์ `src/pos/entities/order.entity.ts` (ประกอบด้วย `id`, `order_no`, `total_amount`, `discount_amount`, `net_amount`, `payment_method` [CASH, PROMPTPAY], `payment_status` [PENDING, COMPLETED, CANCELLED], `cashier_id`, `created_at`, `updated_at`)
- [x] สร้างไฟล์ `src/pos/entities/order-item.entity.ts` (ประกอบด้วย `id`, `order_id`, `product_unit_id`, `qty`, `unit_price`, `subtotal`)

## R1.4 — Supplier & Purchase Order (ระบบจัดซื้อ)

- [x] สร้างไฟล์ `src/pos/entities/supplier.entity.ts` (ประกอบด้วย `id`, `name`, `contact_info`, `created_at`, `updated_at`)
- [x] สร้างไฟล์ `src/pos/entities/purchase-order.entity.ts` (ประกอบด้วย `id`, `po_no`, `supplier_id`, `total_amount`, `status` [PENDING, COMPLETED, CANCELLED], `created_at`, `updated_at`)

## R1.5 — Database Schema Update & Migration

- [x] ตรวจสอบและรันคำสั่งเพื่อสร้างตารางจริงใน Database (เช่น การสร้าง Migration script หรือใช้ `synchronize: true` ชั่วคราวเพื่ออัปเดต Schema ในเครื่อง dev)

## R1.6 — Tests (Unit Tests)

- [x] เนื่องจากเป็นการสร้าง Entity ใหม่ ตรวจสอบว่าจำเป็นต้องเพิ่ม mock หรือทดสอบความสัมพันธ์ใน Service ที่เกี่ยวข้อง (ถ้ามีการแก้ไข Service ใดๆ ต้องเพิ่ม `*.spec.ts` เสมอตาม AGENTS.md)

## R1.7 — Update Documentation

- [x] แก้ไขไฟล์ `.agents/specs/database.md` เพื่อเพิ่มคำอธิบายตารางและโครงสร้างใหม่ทั้งหมด รวมถึง relations ที่เกี่ยวข้องกัน

## R1.8 — Verification

- [x] รัน `npm run build` หรือ `npx tsc --noEmit` เพื่อตรวจสอบความถูกต้องของ type (Type Safety) ข้ามโปรเจกต์
- [x] รัน lint ตรวจสอบไฟล์ `.ts` ใหม่ที่ถูกสร้างขึ้น
- [x] สร้าง commit message ตามข้อกำหนด Conventional Commits สำหรับส่งให้ตรวจสอบ
