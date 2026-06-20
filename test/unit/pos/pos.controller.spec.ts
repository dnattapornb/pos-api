import { Test, TestingModule } from '@nestjs/testing';
import { PosController } from '../../../src/pos/pos.controller';
import { PosService } from '../../../src/pos/pos.service';

describe('PosController', () => {
  let controller: PosController;
  let service: PosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosController],
      providers: [
        {
          provide: PosService,
          useValue: {
            getAllProducts: jest.fn().mockResolvedValue([]),
            getProductById: jest.fn().mockResolvedValue({ id: 1 }),
            createProduct: jest.fn().mockResolvedValue({ id: 1 }),
            updateProduct: jest.fn().mockResolvedValue({ id: 1 }),
            deleteProduct: jest.fn().mockResolvedValue({ message: 'Deleted' }),
            seedProducts: jest.fn().mockResolvedValue({ message: 'Seeded' }),
            receiveGoods: jest.fn().mockResolvedValue({ message: 'Received' }),
            checkout: jest.fn().mockResolvedValue({ message: 'Checkout' }),
          },
        },
      ],
    }).compile();

    controller = module.get<PosController>(PosController);
    service = module.get<PosService>(PosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getAllProducts', async () => {
    const res = await controller.getAllProducts();
    expect(service.getAllProducts).toHaveBeenCalled();
    expect(res).toEqual([]);
  });

  it('should call getProductById', async () => {
    const res = await controller.getProductById(1);
    expect(service.getProductById).toHaveBeenCalledWith(1);
    expect(res).toEqual({ id: 1 });
  });

  it('should call createProduct', async () => {
    const res = await controller.createProduct({ sku: '123' } as any);
    expect(service.createProduct).toHaveBeenCalledWith({ sku: '123' });
    expect(res).toEqual({ id: 1 });
  });

  it('should call updateProduct', async () => {
    const res = await controller.updateProduct(1, { name: 'test' });
    expect(service.updateProduct).toHaveBeenCalledWith(1, { name: 'test' });
    expect(res).toEqual({ id: 1 });
  });

  it('should call deleteProduct', async () => {
    const res = await controller.deleteProduct(1);
    expect(service.deleteProduct).toHaveBeenCalledWith(1);
    expect(res).toEqual({ message: 'Deleted' });
  });

  it('should call seedProducts', async () => {
    const res = await controller.seedProducts();
    expect(service.seedProducts).toHaveBeenCalled();
    expect(res).toEqual({ message: 'Seeded' });
  });

  it('should call receiveGoods', async () => {
    const dto = { barcode: '123', qty: 1 };
    const res = await controller.receiveGoods(dto);
    expect(service.receiveGoods).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ message: 'Received' });
  });

  it('should call checkout', async () => {
    const dto = { items: [{ barcode: '123', qty: 1 }] };
    const res = await controller.checkout(dto);
    expect(service.checkout).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ message: 'Checkout' });
  });
});
