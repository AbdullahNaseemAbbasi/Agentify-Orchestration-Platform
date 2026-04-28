import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { hashPassword, verifyPassword } from '@agentify/common';
import { PrismaService } from '@agentify/database';
import { JwtConfigService } from '../../config/jwt.config';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  type: 'access';
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number; // access TTL in seconds
}

export interface AuthResult {
  user: Pick<User, 'id' | 'email' | 'name'>;
  workspace: { id: string; slug: string; name: string };
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly jwtConfig: JwtConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const slugBase = this.slugify(dto.name) || this.slugify(email.split('@')[0]) || 'workspace';

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash, name: dto.name },
        });

        const slug = await this.uniqueSlug(tx, slugBase);
        const workspace = await tx.workspace.create({
          data: {
            slug,
            name: `${dto.name}'s Workspace`,
            ownerId: user.id,
          },
        });

        await tx.workspaceMember.create({
          data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
        });

        return { user, workspace };
      });

      this.logger.log(`Signup ok user=${result.user.id} workspace=${result.workspace.id}`);

      const tokens = await this.issueTokens(result.user);
      return {
        user: { id: result.user.id, email: result.user.email, name: result.user.name },
        workspace: {
          id: result.workspace.id,
          slug: result.workspace.slug,
          name: result.workspace.name,
        },
        tokens,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A user with this email already exists');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      // Same generic message for missing user vs wrong password — prevents enumeration.
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    let payload: { sub: string; jti: string; type: string };
    try {
      payload = this.jwt.verify(dto.refresh_token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Wrong token type');
    }

    const tokenHash = this.hashToken(dto.refresh_token);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: stored.userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Rotate: revoke the old refresh and issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ----------------------------------------------
  // Internal helpers
  // ----------------------------------------------

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
    };

    const access_token = await this.jwt.signAsync(accessPayload, {
      expiresIn: this.jwtConfig.getAccessTtl(),
    });

    // Refresh token: distinct payload, longer TTL, and we record it in DB hashed.
    const jti = randomBytes(32).toString('hex');
    const refreshPayload = { sub: user.id, jti, type: 'refresh' };
    const refresh_token = await this.jwt.signAsync(refreshPayload, {
      expiresIn: this.jwtConfig.getRefreshTtl(),
    });

    const decoded = this.jwt.decode(refresh_token) as { exp: number } | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refresh_token),
        expiresAt,
      },
    });

    const accessDecoded = this.jwt.decode(access_token) as { iat: number; exp: number } | null;
    const expires_in = accessDecoded ? accessDecoded.exp - accessDecoded.iat : 900;

    return { access_token, refresh_token, token_type: 'Bearer', expires_in };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, base: string): Promise<string> {
    let candidate = base;
    let attempt = 0;
    // Try base, base-1, base-2, … up to a small ceiling. After that, append random.
    while (await tx.workspace.findUnique({ where: { slug: candidate } })) {
      attempt += 1;
      candidate = attempt < 50 ? `${base}-${attempt}` : `${base}-${randomBytes(3).toString('hex')}`;
      if (attempt > 100) {
        throw new Error('Unable to generate unique workspace slug');
      }
    }
    return candidate;
  }
}
