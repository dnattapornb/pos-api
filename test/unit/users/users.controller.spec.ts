import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../../src/users/users.controller';
import { UsersService } from '../../../src/users/users.service';
import { CreateUserDto } from '../../../src/users/dto/create-user.dto';
import { UpdateUserDto } from '../../../src/users/dto/update-user.dto';
import { Role } from '../../../src/users/enums/role.enum';
import { User } from '../../../src/users/entities/user.entity';

type MockUsersService = Record<keyof UsersService, jest.Mock>;

describe('UsersController', () => {
  let controller: UsersController;
  let service: MockUsersService;

  beforeEach(async () => {
    service = {
      getAllUsers: jest.fn(),
      getUserById: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
    } as MockUsersService;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('getAllUsers', () => {
    it('should return an array of users without passwordHash', async () => {
      const user = {
        id: 1,
        username: 'test',
        passwordHash: 'hash',
        role: Role.CASHIER,
      } as User;
      service.getAllUsers.mockResolvedValue([user]);

      const result = await controller.getAllUsers();

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result[0].id).toBe(1);
      expect(service.getAllUsers).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return a user without passwordHash', async () => {
      const user = {
        id: 1,
        username: 'test',
        passwordHash: 'hash',
        role: Role.CASHIER,
      } as User;
      service.getUserById.mockResolvedValue(user);

      const result = await controller.getUserById(1);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(1);
      expect(service.getUserById).toHaveBeenCalledWith(1);
    });
  });

  describe('createUser', () => {
    it('should create and return a new user without passwordHash', async () => {
      const createDto: CreateUserDto = {
        username: 'test',
        password: 'password',
        role: Role.CASHIER,
      };

      const createdUser = {
        id: 1,
        username: 'test',
        passwordHash: 'hash',
        role: Role.CASHIER,
      } as User;
      service.createUser.mockResolvedValue(createdUser);

      const result = await controller.createUser(createDto);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(1);
      expect(service.createUser).toHaveBeenCalledWith(createDto);
    });
  });

  describe('updateUser', () => {
    it('should update and return a user without passwordHash', async () => {
      const updateDto: UpdateUserDto = {
        username: 'test2',
      };

      const updatedUser = {
        id: 1,
        username: 'test2',
        passwordHash: 'hash',
        role: Role.CASHIER,
      } as User;
      service.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateUser(1, updateDto);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.username).toBe('test2');
      expect(service.updateUser).toHaveBeenCalledWith(1, updateDto);
    });
  });
});
