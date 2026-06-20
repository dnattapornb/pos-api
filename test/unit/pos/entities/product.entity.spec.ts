import { Product } from '../../../../src/pos/entities/product.entity';
import { UnitName } from '../../../../src/pos/enums/unit.enum';

/**
 * Timezone policy guard:
 * `created_at` / `updated_at` are stored as Asia/Bangkok (+07) Thai local time
 * in MySQL, and the TypeORM `mysql2` driver is pinned to `timezone: '+07:00'`
 * so the `Date` it produces represents the correct instant. When that entity is
 * serialized to JSON (as NestJS does for responses), the `Date` columns emit a
 * canonical ISO 8601 instant string ending in `Z` (via `Date.toISOString()`).
 * The client converts that instant to +07 for display.
 */
describe('Product entity timezone serialization', () => {
  const buildProduct = (createdAt: Date, updatedAt: Date): Product => {
    const product = new Product();
    product.id = 1;
    product.sku = 'SKU-001';
    product.name = 'น้ำอัดลม 325 มล.';
    product.baseUnitName = UnitName.BOTTLE;
    product.costPrice = 12;
    product.published = true;
    product.createdAt = createdAt;
    product.updatedAt = updatedAt;
    return product;
  };

  it('serializes createdAt / updatedAt as a canonical ISO 8601 instant (ends in Z)', () => {
    // The instant for a record created at Thai 2026-06-20 14:00:00 (+07).
    const instant = new Date(Date.UTC(2026, 5, 20, 7, 0, 0, 0));
    const product = buildProduct(instant, instant);

    const serialized = JSON.parse(JSON.stringify(product)) as {
      createdAt: string;
      updatedAt: string;
    };

    expect(serialized.createdAt).toBe('2026-06-20T07:00:00.000Z');
    expect(serialized.updatedAt).toBe('2026-06-20T07:00:00.000Z');
  });

  it('serializes the exact instant with no double-offset skew', () => {
    const instant = new Date(Date.UTC(2026, 5, 20, 23, 30, 0, 0));
    const product = buildProduct(instant, instant);

    const { createdAt } = JSON.parse(JSON.stringify(product)) as {
      createdAt: string;
    };

    expect(createdAt.endsWith('Z')).toBe(true);
    // The serialized value must equal the raw instant. Because the driver
    // timezone (+07) matches the MySQL server timezone (+07), no extra offset
    // is applied on top of the stored Thai wall-clock value.
    expect(createdAt).toBe(instant.toISOString());
  });
});
