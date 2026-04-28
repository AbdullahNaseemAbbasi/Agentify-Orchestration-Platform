import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { hashPassword } from '@agentify/common';
import { PrismaService } from '@agentify/database';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase();

    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          name: dto.name,
        },
      });
      this.logger.log(`Created user ${user.id} (${user.email})`);
      return user;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A user with this email already exists');
      }
      throw err;
    }
  }
}
