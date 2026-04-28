import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: JwtUser): Promise<{
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    createdAt: Date;
  }> {
    const user = await this.usersService.findById(current.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Never return passwordHash or other sensitive fields.
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
