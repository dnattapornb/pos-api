import { Test, TestingModule } from '@nestjs/testing';
import { PosService } from '../../../src/pos/pos.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../../../src/pos/entities/product.entity';
import { ProductUnit } from '../../../src/pos/entities/product-unit.entity';
import { Inventory } from '../../../src/pos/entities/inventory.entity';
import { DataSource } from 'typeorm';

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
    },
  };

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
          },
        },
        {
          provide: getRepositoryToken(ProductUnit),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
            findOne: jest.fn(),
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
});
