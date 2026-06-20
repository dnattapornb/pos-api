---
name: nestjs-unit-test
description: Use when writing or fixing NestJS/Jest unit tests (*.spec.ts) so they pass the strict typescript-eslint rules. Covers lint-safe mocking patterns for unbound-method, no-unsafe-* and no-unused-vars. Explain choices in Thai, keep code in English.
---

# NestJS Unit Test (Lint-Safe Patterns)

When writing or fixing `*.spec.ts` files, you MUST follow these rules so the strict
`typescript-eslint` config does not report errors. Keep all test code in **English**;
explain your reasoning to the user in **Thai**.

These patterns exist because the project runs `typescript-eslint` in type-checked mode.
The three rules that bite test files most often are:

- `@typescript-eslint/unbound-method`
- `@typescript-eslint/no-unsafe-assignment` / `no-unsafe-argument` / `no-unsafe-return`
- `@typescript-eslint/no-unused-vars`

## 1. Mock dependencies with a typed plain object, NOT the class type

`unbound-method` fires when you reference a real class method without calling it, e.g.
`expect(service.getAllProducts).toHaveBeenCalled()` where `service: PosService`.
Referencing a class method standalone is flagged because `this` could be lost.

Fix: hold the mock as a plain object whose properties are `jest.Mock`. Property access on
a plain object literal is NOT an unbound class method, so the rule stays quiet.

```ts
// ✅ Good — plain typed mock object
type MockPosService = Record<keyof PosService, jest.Mock>;

let service: MockPosService;

beforeEach(async () => {
  service = {
    getAllProducts: jest.fn().mockResolvedValue([]),
    createProduct: jest.fn().mockResolvedValue({ id: 1 }),
    // ...one entry per method used in the test
  } as MockPosService;

  const module = await Test.createTestingModule({
    controllers: [PosController],
    providers: [{ provide: PosService, useValue: service }],
  }).compile();

  controller = module.get<PosController>(PosController);
});

it('calls getAllProducts', async () => {
  await controller.getAllProducts();
  expect(service.getAllProducts).toHaveBeenCalled(); // no unbound-method error
});
```

```ts
// ❌ Bad — references a real class method, triggers unbound-method
let service: PosService;
service = module.get<PosService>(PosService);
expect(service.getAllProducts).toHaveBeenCalled();
```

## 2. Never use `as any` for DTOs or mock arguments

`no-unsafe-argument` / `no-unsafe-assignment` fire when an `any` value flows into a typed
parameter. `{ sku: '123' } as any` is the usual culprit.

Fix: build a fully-typed DTO object instead of casting to `any`. This also makes the test
fail fast if the DTO shape changes.

```ts
// ✅ Good — fully typed DTO
const dto: CreateProductDto = {
  sku: '123',
  name: 'Test product',
  baseUnitName: UnitName.BOTTLE,
  costPrice: 10,
  units: [
    { barcode: '8850001', unitName: UnitName.BOTTLE, multiplier: 1, retailPrice: 15, wholesalePrice: 14 },
  ],
};
await controller.createProduct(dto);
```

```ts
// ❌ Bad — any flows into a typed parameter
await controller.createProduct({ sku: '123' } as any);
```

If a value genuinely cannot be fully typed, cast to the concrete expected type
(`as CreateProductDto`) or `as unknown as T` — never `as any`.

## 3. Type `mockImplementation` parameters

`no-unsafe-return` fires when a callback receives an implicit `any` and returns it, e.g.
`jest.fn().mockImplementation((dto) => dto)` — `dto` is `any`, so the return is unsafe.

Fix: annotate the parameter with the real (or `Partial<>`) entity type.

```ts
// ✅ Good
create: jest.fn().mockImplementation((dto: Partial<Product>) => dto),

// ❌ Bad — dto is any, return is unsafe
create: jest.fn().mockImplementation((dto) => dto),
```

## 4. Do not keep unused `module.get` handles

`no-unused-vars` fires on `let dataSource: DataSource;` + `dataSource = module.get(...)`
when `dataSource` is never read afterward.

Fix: only resolve and store the mocks you actually assert against. Drop the unused
declaration and its `module.get(...)` line entirely.

```ts
// ✅ Good — only what the test uses
service = module.get<PosService>(PosService);
unitRepo = module.get(getRepositoryToken(ProductUnit));

// ❌ Bad — dataSource is never read
dataSource = module.get<DataSource>(DataSource);
```

## 5. Verify before declaring done

1. `npx eslint <file.spec.ts>` MUST report 0 problems (run `--fix` to clear pure
   `prettier/prettier` formatting items).
2. `npx jest <path>` MUST pass.

Run both file-scoped before finishing the change.

## 6. Access private members through a typed view, not `as any`

`(service as any).privateMethod` / `(service as any).privateField` triggers a cascade of
`no-unsafe-call` / `no-unsafe-member-access`. Declare a local type that exposes only the
private members the test touches, then cast once with `as unknown as`.

```ts
// ✅ Good
type LineServiceInternal = {
  lineClient: { replyMessage: jest.Mock; pushMessage: jest.Mock };
  handlePostback: (event: unknown) => Promise<void>;
  safeReplyText: (replyToken: string | undefined, text: string) => Promise<void>;
};

const internal = service as unknown as LineServiceInternal;
jest.spyOn(internal, 'handlePostback').mockResolvedValue(undefined);
await internal.safeReplyText('rt1', 'msg'); // fully typed, no unsafe-call
```

```ts
// ❌ Bad — every access is `any`
jest.spyOn(service as any, 'handlePostback');
await (service as any).safeReplyText('rt1', 'msg');
```

## 7. Retrieve values from a `jest.mock` factory with `jest.requireMock<T>()`

Do NOT use `require(...)` (forbidden by `no-require-imports`) and do NOT leave the result
`any`. Pass the expected shape as the generic argument so the value is typed.

```ts
// ✅ Good
jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({ generateContent: mockGenerateContent }),
    })),
    mockGenerateContent, // expose for the test
  };
});

const { mockGenerateContent } = jest.requireMock<{ mockGenerateContent: jest.Mock }>(
  '@google/generative-ai',
);
```

```ts
// ❌ Bad — require import forbidden + unsafe assignment
const { mockGenerateContent } = require('@google/generative-ai');
```

## 8. Navigate untyped output with a small structural type

When asserting against a deeply-nested object that the typings expose as a wide union
(e.g. a LINE Flex bubble), declare a minimal structural interface and cast with
`as unknown as`, instead of `as any` followed by member access.

```ts
// ✅ Good
interface FlexNode {
  type?: string;
  text?: string;
  action?: { data?: string };
  header?: FlexNode;
  footer?: FlexNode;
  contents?: FlexNode[];
}

const bubble = flex.contents as unknown as FlexNode;
expect(bubble.footer?.contents?.[0].action?.data).toBe('action=approve&id=rcpt_123');
```

For a partial mock return value, cast to the real type the same way:
`mockReturnValue({ type: 'flex', altText: 'x' } as unknown as messagingApi.FlexMessage)`.

## 9. Remove unused imports and `module.get` handles

`no-unused-vars` fires on imports kept only "just in case" and on `module.get(...)` results
never asserted against. Import a symbol only when used as a value (a DI token still counts);
if a module is mocked purely by its string path in `jest.mock(...)`, do NOT import it.
