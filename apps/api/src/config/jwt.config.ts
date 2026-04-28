import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtOptionsFactory } from '@nestjs/jwt';

/**
 * Loads RS256 keypair from disk and exposes JwtModule options.
 * Keys are read once at module init — server restart required to rotate.
 */
@Injectable()
export class JwtConfigService implements JwtOptionsFactory {
  private readonly logger = new Logger(JwtConfigService.name);
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(private readonly config: ConfigService) {
    const privateKeyPath = resolve(
      process.cwd(),
      this.config.getOrThrow<string>('JWT_PRIVATE_KEY_PATH'),
    );
    const publicKeyPath = resolve(
      process.cwd(),
      this.config.getOrThrow<string>('JWT_PUBLIC_KEY_PATH'),
    );

    if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
      throw new Error(
        `JWT keys not found. Run: npm run keys:generate\n` +
          `Looked for:\n  ${privateKeyPath}\n  ${publicKeyPath}`,
      );
    }

    this.privateKey = readFileSync(privateKeyPath, 'utf8');
    this.publicKey = readFileSync(publicKeyPath, 'utf8');

    this.logger.log('Loaded RSA keypair for JWT signing');
  }

  createJwtOptions(): JwtModuleOptions {
    return {
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      signOptions: {
        algorithm: 'RS256',
        issuer: this.config.get<string>('JWT_ISSUER', 'agentify'),
        audience: this.config.get<string>('JWT_AUDIENCE', 'agentify-api'),
      },
      verifyOptions: {
        algorithms: ['RS256'],
        issuer: this.config.get<string>('JWT_ISSUER', 'agentify'),
        audience: this.config.get<string>('JWT_AUDIENCE', 'agentify-api'),
      },
    };
  }

  getAccessTtl(): string {
    return this.config.get<string>('JWT_ACCESS_TTL', '15m');
  }

  getRefreshTtl(): string {
    return this.config.get<string>('JWT_REFRESH_TTL', '30d');
  }
}
