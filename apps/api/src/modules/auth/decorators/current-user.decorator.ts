import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { JwtUser } from '../strategies/jwt.strategy';

/**
 * Extracts the authenticated user (populated by JwtStrategy.validate)
 * from the request. Use on routes guarded by JwtAuthGuard.
 *
 * Example:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   me(@CurrentUser() user: JwtUser) { return user; }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return request.user;
  },
);
