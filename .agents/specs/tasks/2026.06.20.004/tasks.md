# Phase: Move Product Unit endpoints under `/pos/product/unit`

**Goal:** จัด REST path ของ "product unit" ให้อยู่ใต้ resource `product` และเปลี่ยน
key จาก `barcode` มาเป็น `id` (`product_unit.id`) ให้สอดคล้องกับ endpoint อื่นที่ใช้
`ParseIntPipe` พร้อมเพิ่ม CRUD ครบ (get / create / update / delete)

**Endpoint design (reviewed):**

| Method | Old | New | `:id` / key |
|---|---|---|---|
| DELETE | `/pos/unit/:barcode` | `/pos/product/unit/:id` | `product_unit.id` |
| GET | — (add) | `/pos/product/unit/:id` | `product_unit.id` |
| PUT | — (add) | `/pos/product/unit/:id` | `product_unit.id` |
| POST | — (add) | `/pos/product/unit` | `productId` มาจาก **body** |

**Decisions (reviewed):**
- `GET` / `PUT` / `DELETE` ใช้ `:id` = `product_unit.id` (เป็น `number`, ผ่าน `ParseIntPipe`)
- `POST` (create) ไม่ใส่ `:id` บน path — ส่ง `productId` ใน body แทน (unit ยังไม่มี id ตอนสร้าง)
- `DELETE` ยังคงเป็น **soft delete** (`published = false`) ให้สอดคล้องกับ `deleteProduct`/พฤติกรรมเดิม
- `GET` filter `published: true` ให้สอดคล้องกับ `getProductById`

**Routing order caveat:** NestJS match route ตามลำดับการประกาศ method ใน controller
ดังนั้น route `product/unit/:id` (GET/PUT/DELETE) **ต้องประกาศก่อน** `product/:id`
มิฉะนั้น `/pos/product/unit/5` จะไป match `product/:id` ด้วย `id="unit"` แล้ว `ParseIntPipe`
จะ throw 400

**Affected files:** `src/pos/pos.controller.ts`, `src/pos/pos.service.ts`,
`src/pos/dto/pos.dto.ts`, `test/unit/pos/pos.controller.spec.ts`,
`test/unit/pos/pos.service.spec.ts`, `.agents/references/pos-api.md`,
`http/pos.http`

## R4.1 — DTO: เพิ่ม DTO สำหรับ create/update unit แบบ standalone

- [x] `AddProductUnitDto extends CreateProductUnitDto` เพิ่มฟิลด์ `productId: number` (`@IsNumber()` + `@IsPositive()`) สำหรับ `POST /pos/product/unit`
- [x] `UpdateProductUnitDto`: ทุกฟิลด์ optional ตามกฎเดิมของ `CreateProductUnitDto` (`barcode?`, `unitName?`, `multiplier?`, `retailPrice?`, `wholesalePrice?`) + `published?: boolean`

## R4.2 — Service: เพิ่ม/แก้ method สำหรับ product unit

- [x] `getProductUnitById(id: number)`: หา unit จาก `id` โดย filter `published: true` (include relation `product`), ไม่เจอ → throw `BadRequestException('Product unit not found')`
- [x] `createProductUnit(dto: AddProductUnitDto)`: หา `product` จาก `dto.productId` (ไม่เจอ → `BadRequestException('Product not found')`), `create` + `save` unit ใหม่ผูกกับ product, return unit ที่สร้าง; กรณี `barcode` ซ้ำ (unique) → จับ error เป็น `BadRequestException`
- [x] `updateProductUnit(id: number, dto: UpdateProductUnitDto)`: หา unit จาก `id` (ไม่เจอ → throw), อัปเดตเฉพาะฟิลด์ที่ส่งมา, `save`, return unit
- [x] `deleteProductUnit(id: number)`: เปลี่ยน signature จาก `barcode: string` → `id: number`, หา unit จาก `id`, set `published = false`, `save` (soft delete), return `{ message }` ที่อ้างถึง `id`

## R4.3 — Controller: ย้าย/เพิ่ม route ใต้ `product/unit`

- [x] ลบ `@Delete('unit/:barcode') deleteProductUnit(@Param('barcode'))`
- [x] เพิ่ม route ใหม่ **ก่อน** `@Get('product/:id')` (ดู routing caveat):
  - [x] `@Get('product/unit/:id')` → `getProductUnitById(@Param('id', ParseIntPipe) id)`
  - [x] `@Put('product/unit/:id')` → `updateProductUnit(id, @Body() dto: UpdateProductUnitDto)`
  - [x] `@Delete('product/unit/:id')` → `deleteProductUnit(@Param('id', ParseIntPipe) id)`
- [x] เพิ่ม `@Post('product/unit')` → `createProductUnit(@Body() dto: AddProductUnitDto)` (ไม่มี path param)
- [x] import DTO ใหม่ใน controller

## R4.4 — อัปเดต unit test

- [x] `pos.controller.spec.ts`: เปลี่ยนเคส `deleteProductUnit` ให้เรียกด้วย `1` (id) แทน `'8850001'`; เพิ่ม mock + เคส `getProductUnitById`, `createProductUnit`, `updateProductUnit`
- [x] `pos.service.spec.ts`: เพิ่มเคส `getProductUnitById` (เจอ/ไม่เจอ), `createProductUnit` (เจอ product → create+save / ไม่เจอ product → throw), `updateProductUnit` (อัปเดตฟิลด์ที่ส่งมา / ไม่เจอ → throw), `deleteProductUnit` by id (soft delete / ไม่เจอ → throw); แก้เคส `deleteProductUnit` เดิมที่อิง barcode

## R4.5 — อัปเดตเอกสาร

- [x] `.agents/references/pos-api.md`: แก้ Endpoint Summary — ลบแถว `DELETE /pos/unit/:barcode`, เพิ่มแถว GET/POST/PUT/DELETE ของ product unit; แทนที่ section "Delete product unit" ด้วย section "Product units" ที่อธิบายครบ 4 endpoint (ความหมายของ `:id`, body, ตัวอย่าง response, การ soft delete)
- [x] `http/pos.http`: แทนที่ `DELETE {{baseUrl}}/pos/unit/8850001` ด้วย section "Product units" ที่มี GET/POST/PUT/DELETE ครบ

## R4.6 — ตรวจสอบความถูกต้อง

- [x] รัน targeted test: `npx jest test/unit/pos`
- [x] รัน `npm run build` (หรือ `npx tsc --noEmit`) ยืนยัน type safety
- [x] รัน lint เฉพาะไฟล์ที่แก้
- [ ] (ถ้ารัน server ได้) ยืนยันด้วย `http/pos.http`: create → get → update → delete unit ทำงานถูกต้อง — _ยังไม่ได้รัน (ต้องมี MySQL/server) ปล่อยให้ human ยืนยันด้วย `http/pos.http`_
- [x] เตรียม conventional commit message จาก `git diff` จริง

## Out of Scope / Notes

- ไม่แตะ logic การ upsert units ใน `updateProduct()` (เฟส `2026.06.20.003`) — endpoint ใหม่นี้จัดการ unit รายตัวแยกต่างหาก
- `barcode` ยังคง unique ทั้งตาราง; การส่ง `barcode` ซ้ำตอน create/update จะ throw จาก DB เหมือนเดิม
- การลบเป็น soft delete เท่านั้น (ไม่มี hard delete ในเฟสนี้)
