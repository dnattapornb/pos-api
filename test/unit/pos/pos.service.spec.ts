import { Test, TestingModule } from '@nestjs/testing';
import { PosService } from '../../../src/pos/pos.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../../../src/pos/entities/product.entity';
import { ProductUnit } from '../../../src/pos/entities/product-unit.entity';
import { Inventory } from '../../../src/pos/entities/inventory.entity';
import { DataSource } from 'typeorm';
import { UnitName } from '../../../src/pos/enums/unit.enum';

describe('PosService', () => {
  let service: PosService;
  let dataSource: DataSource;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    },
    query: jest.fn(),
  };

  let unitRepo: { create: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let productRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation((dto) => dto),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProductUnit),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Inventory),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<PosService>(PosService);
    dataSource = module.get<DataSource>(DataSource);
    unitRepo = module.get(getRepositoryToken(ProductUnit));
    productRepo = module.get(getRepositoryToken(Product));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('seedProducts', () => {
    it('should seed products if count is 0', async () => {
      const res = await service.seedProducts();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(res.message).toBe('Products seeded successfully');
    });
  });

  describe('updateProduct (upsert units by barcode)', () => {
    it('updates an existing unit in place without wiping all units', async () => {
      const existingUnit = {
        id: 10,
        barcode: '8850001',
        unitName: UnitName.BOTTLE,
        multiplier: 1,
        retailPrice: 15,
        wholesalePrice: 14,
        published: true,
      };
      const product = { id: 1, units: [existingUnit] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(product);
      productRepo.findOne.mockResolvedValueOnce({ id: 1 });

      await service.updateProduct(1, {
        units: [
          {
            barcode: '8850001',
            unitName: UnitName.BOTTLE,
            multiplier: 1,
            retailPrice: 16,
            wholesalePrice: 15,
          },
        ],
      });

      // Same object mutated and saved — id preserved
      expect(existingUnit.retailPrice).toBe(16);
      expect(existingUnit.wholesalePrice).toBe(15);
      expect(existingUnit.id).toBe(10);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(existingUnit);
      // Must NOT do the old wipe-and-recreate
      expect(mockQueryRunner.manager.delete).not.toHaveBeenCalled();
      // No new unit created for an existing barcode
      expect(unitRepo.create).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('creates a new unit when the barcode does not exist yet', async () => {
      const product = { id: 1, units: [] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(product);
      productRepo.findOne.mockResolvedValueOnce({ id: 1 });

      await service.updateProduct(1, {
        units: [
          {
            barcode: '9990000',
            unitName: UnitName.PACK,
            multiplier: 6,
            retailPrice: 85,
            wholesalePrice: 80,
          },
        ],
      });

      expect(unitRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ product, barcode: '9990000', multiplier: 6 }),
      );
      expect(mockQueryRunner.manager.delete).not.toHaveBeenCalled();
    });

    it('re-publishes a previously soft-deleted unit when its barcode is resent', async () => {
      const softDeleted = {
        id: 5,
        barcode: '8850001',
        unitName: UnitName.BOTTLE,
        multiplier: 1,
        retailPrice: 15,
        wholesalePrice: 14,
        published: false,
      };
      const product = { id: 1, units: [softDeleted] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(product);
      productRepo.findOne.mockResolvedValueOnce({ id: 1 });

      await service.updateProduct(1, {
        units: [
          {
            barcode: '8850001',
            unitName: UnitName.BOTTLE,
            multiplier: 1,
            retailPrice: 15,
            wholesalePrice: 14,
          },
        ],
      });

      expect(softDeleted.published).toBe(true);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(softDeleted);
    });

    it('does not touch units when dto.units is omitted', async () => {
      const product = { id: 1, units: [{ id: 1, barcode: '8850001' }] };
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(product);
      productRepo.findOne.mockResolvedValueOnce({ id: 1 });

      await service.updateProduct(1, { name: 'New name' });

      expect(unitRepo.create).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.delete).not.toHaveBeenCalled();
      // Only the product entity itself is saved
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteProductUnit', () => {
    it('soft deletes a unit by barcode', async () => {
      const unit = { id: 1, barcode: '8850001', published: true };
      unitRepo.findOne.mockResolvedValueOnce(unit);

      const res = await service.deleteProductUnit('8850001');

      expect(unit.published).toBe(false);
      expect(unitRepo.save).toHaveBeenCalledWith(unit);
      expect(res.message).toBe('Product unit 8850001 has been deleted');
    });

    it('throws when the barcode is not found', async () => {
      unitRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteProductUnit('does-not-exist')).rejects.toThrow(
        'Product unit not found',
      );
      expect(unitRepo.save).not.toHaveBeenCalled();
    });
  });
});
