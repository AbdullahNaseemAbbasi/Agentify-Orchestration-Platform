import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@agentify/database';

export interface JwtUser {
  id: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const publicKey = readFileSync(
      resolve(process.cwd(), config.getOrThrow<string>('JWT_PUBLIC_KEY_PATH')),
      'utf8',
    );

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
      issuer: config.get<string>('JWT_ISSUER', 'agentify'),
      audience: config.get<string>('JWT_AUDIENCE', 'agentify-api'),
    });
  }

  async validate(payload: { sub?: string; email?: string; type?: string }): Promise<JwtUser> {
    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }
}
