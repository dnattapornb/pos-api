import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find();
  }

  async getUserById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const { username, password, role } = createUserDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUser) {
      throw new ConflictException(`Username ${username} already exists`);
    }

    // Hash password
    const saltOrRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltOrRounds);

    const user = this.userRepository.create({
      username,
      passwordHash,
      ...(role && { role }),
    });

    return this.userRepository.save(user);
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.getUserById(id);

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUser = await this.userRepository.findOne({
        where: { username: updateUserDto.username },
      });
      if (existingUser) {
        throw new ConflictException(
          `Username ${updateUserDto.username} already exists`,
        );
      }
      user.username = updateUserDto.username;
    }

    if (updateUserDto.password) {
      const saltOrRounds = 10;
      user.passwordHash = await bcrypt.hash(
        updateUserDto.password,
        saltOrRounds,
      );
    }

    if (updateUserDto.role) {
      user.role = updateUserDto.role;
    }

    return this.userRepository.save(user);
  }
}
