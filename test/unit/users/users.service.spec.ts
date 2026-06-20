import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../../src/users/users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../../src/users/entities/user.entity';
import { Role } from '../../../src/users/enums/role.enum';
import { CreateUserDto } from '../../../src/users/dto/create-user.dto';
import { UpdateUserDto } from '../../../src/users/dto/update-user.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

jest.mock('bcrypt');

type MockRepository = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should return an array of users', async () => {
      const users = [{ id: 1, username: 'test1' } as User];
      repo.find.mockResolvedValue(users);

      const result = await service.getAllUsers();
      expect(result).toEqual(users);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return a user if found', async () => {
      const user = { id: 1, username: 'test1' } as User;
      repo.findOne.mockResolvedValue(user);

      const result = await service.getUserById(1);
      expect(result).toEqual(user);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException if user not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getUserById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createUser', () => {
    it('should successfully create a new user', async () => {
      const createDto: CreateUserDto = {
        username: 'test',
        password: 'password',
        role: Role.CASHIER,
      };

      repo.findOne.mockResolvedValue(null); // No existing user

      const { hash } = jest.requireMock<{ hash: jest.Mock }>('bcrypt');
      hash.mockResolvedValue('hashedPassword');

      const createdUser = {
        id: 1,
        ...createDto,
        passwordHash: 'hashedPassword',
      } as unknown as User;
      repo.create.mockReturnValue(createdUser);
      repo.save.mockResolvedValue(createdUser);

      const result = await service.createUser(createDto);

      expect(result).toEqual(createdUser);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { username: createDto.username },
      });
      expect(hash).toHaveBeenCalledWith(createDto.password, 10);
      expect(repo.create).toHaveBeenCalledWith({
        username: createDto.username,
        passwordHash: 'hashedPassword',
        role: createDto.role,
      });
      expect(repo.save).toHaveBeenCalledWith(createdUser);
    });

    it('should throw ConflictException if username exists', async () => {
      const createDto: CreateUserDto = {
        username: 'test',
        password: 'password',
      };

      repo.findOne.mockResolvedValue({ id: 1, username: 'test' } as User);

      await expect(service.createUser(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateUser', () => {
    it('should update user password and role', async () => {
      const existingUser = {
        id: 1,
        username: 'test',
        passwordHash: 'oldHash',
        role: Role.CASHIER,
      } as User;
      repo.findOne.mockResolvedValueOnce(existingUser); // For getUserById

      const updateDto: UpdateUserDto = {
        password: 'newPassword',
        role: Role.ADMIN,
      };

      const { hash } = jest.requireMock<{ hash: jest.Mock }>('bcrypt');
      hash.mockResolvedValue('newHash');

      const updatedUser = {
        ...existingUser,
        passwordHash: 'newHash',
        role: Role.ADMIN,
      } as User;
      repo.save.mockResolvedValue(updatedUser);

      const result = await service.updateUser(1, updateDto);

      expect(result).toEqual(updatedUser);
      expect(hash).toHaveBeenCalledWith('newPassword', 10);
      expect(repo.save).toHaveBeenCalledWith(existingUser);
      expect(existingUser.passwordHash).toBe('newHash');
      expect(existingUser.role).toBe(Role.ADMIN);
    });

    it('should throw ConflictException if updating to existing username', async () => {
      const existingUser = { id: 1, username: 'test1' } as User;
      // First findOne from getUserById
      repo.findOne.mockResolvedValueOnce(existingUser);
      // Second findOne from username check
      repo.findOne.mockResolvedValueOnce({ id: 2, username: 'test2' } as User);

      const updateDto: UpdateUserDto = {
        username: 'test2',
      };

      await expect(service.updateUser(1, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
