# Phase: Upsert Product Units on Update (stop delete + recreate)

**Goal:** เปลี่ยนพฤติกรรมของ `PosService.updateProduct()` จากการ "wipe &
recreate" (`DELETE` ทุก `product_unit` แล้วสร้างใหม่) มาเป็น **upsert by
`barcode`** เพื่อคง `id` / `created_at` ของ unit ที่ยังอยู่ และเลี่ยงการลบ-สร้างใหม่
โดยไม่จำเป็น

**Match key:** `barcode` (unique ใน `product_unit`; DTO `CreateProductUnitDto`
ไม่มี `id`)

**Decisions (reviewed):**
- การจัดการ unit เดิมที่ไม่อยู่ใน payload → **Option C: ไม่ลบเลย** (update/insert
  เท่านั้น) การลบ unit ต้องไปทำผ่าน endpoint แยก
- เพิ่ม REST endpoint แยกสำหรับลบ unit: `DELETE /pos/unit/:barcode` (soft delete →
  `published = false` ให้สอดคล้องกับ `deleteProduct`)
- unit ที่เคย soft-delete (`published = false`) แล้วถูกส่ง barcode เดิมกลับมาผ่าน
  update → **re-publish (`published = true`) อัตโนมัติ**

**Affected files:** `src/pos/pos.service.ts`, `src/pos/pos.controller.ts`,
`test/unit/pos/pos.service.spec.ts`, `test/unit/pos/pos.controller.spec.ts`,
`.agents/references/pos-api.md`, `.agents/specs/database.md`

## R3.1 — Refactor `updateProduct()` เป็น upsert by barcode (Option C)

- [x] โหลด `product` พร้อม `relations: { units: true }` (มีอยู่แล้ว) และสร้าง map ของ unit เดิมโดยใช้ `barcode` เป็น key
- [x] วน `dto.units`: ถ้าเจอ barcode เดิม → อัปเดต field (`unitName`, `multiplier`, `retailPrice`, `wholesalePrice`) บน entity เดิม + `published = true` (re-publish) แล้ว `save`; ถ้าไม่เจอ → `create` + `save` row ใหม่ผูกกับ `product`
- [x] **ไม่** ลบ unit เดิมที่ไม่อยู่ใน payload (Option C)
- [x] ลบบรรทัด `await queryRunner.manager.delete(ProductUnit, { product: { id } });` (กลยุทธ์ wipe เดิม) ออก
- [x] คงทุกอย่างไว้ใน transaction (`queryRunner`) เดิม และ rollback เมื่อ error

## R3.2 — เพิ่ม endpoint ลบ unit แยก

- [x] `PosService.deleteProductUnit(barcode)`: หา unit จาก `barcode`, ถ้าไม่เจอ throw `BadRequestException('Product unit not found')`, ถ้าเจอ set `published = false` แล้ว `save` (soft delete), return `{ message }`
- [x] `PosController`: เพิ่ม `@Delete('unit/:barcode')` เรียก `deleteProductUnit`

## R3.3 — อัปเดต unit test

- [x] `pos.service.spec.ts`: เพิ่ม mock ที่ขาดใน `mockQueryRunner.manager.findOne`/`save`; เคส upsert: barcode เดิม → อัปเดต in-place (`save` บน object เดิม, **ไม่** เรียก bulk `delete`); barcode ใหม่ → `create` + `save`; barcode เดิมที่เคย soft-delete → `published` กลับเป็น `true`; ไม่ส่ง `units` → ไม่แตะ unit
- [x] `pos.service.spec.ts`: เคส `deleteProductUnit` → soft delete สำเร็จ + เคสไม่เจอ barcode → throw
- [x] `pos.controller.spec.ts`: เพิ่ม mock + เคสเรียก `deleteProductUnit`

## R3.4 — อัปเดตเอกสาร

- [x] `.agents/references/pos-api.md` (หัวข้อ "Update product"): เปลี่ยนหมายเหตุจาก "replaces all existing units (delete + recreate)" เป็น **upsert by barcode** (ไม่ลบตัวที่ไม่ส่งมา, re-publish ตัวที่เคยลบ); เพิ่ม endpoint `DELETE /pos/unit/:barcode` ใน summary + รายละเอียด
- [x] `.agents/specs/database.md` (ตาราง `product_unit`): เพิ่มหมายเหตุสั้น ๆ ว่า update ใช้ upsert by `barcode` คง `id`/`created_at`; ลบ unit เป็น soft delete

## R3.5 — ตรวจสอบความถูกต้อง

- [x] รัน targeted test: `npx jest test/unit/pos`
- [x] รัน `npm run build` (หรือ `npx tsc --noEmit`) เพื่อยืนยัน type safety ทั้งโปรเจกต์
- [x] รัน lint เฉพาะไฟล์ที่แก้
- [x] (ถ้ารัน server ได้) ยืนยันด้วย `http/pos.http`: update ซ้ำแล้ว `id`/`createdAt` ของ unit เดิมไม่เปลี่ยน
- [x] เตรียม conventional commit message จาก `git diff` จริง

## Out of Scope / Notes

- ไม่เพิ่มฟิลด์ `id` ลงใน `CreateProductUnitDto`/`UpdateProductDto` (match ด้วย `barcode` พอ)
- กรณี `barcode` ใน payload ชนกับ unit ของ product อื่น (unique ทั้งตาราง) จะ throw จาก DB เหมือนเดิม — ไม่จัดการเพิ่มในเฟสนี้
