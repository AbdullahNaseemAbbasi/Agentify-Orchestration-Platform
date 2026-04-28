import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DbHealth, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('db')
  async readinessDb(): Promise<DbHealth> {
    return this.healthService.checkDatabase();
  }
}
