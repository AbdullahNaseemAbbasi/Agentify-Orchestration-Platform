import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { WorkspaceContext } from '../guards/workspace.guard';

/**
 * Extracts the WorkspaceContext that WorkspaceGuard attaches to req.workspace.
 * Use on routes guarded by JwtAuthGuard + WorkspaceGuard.
 *
 * Example:
 *   @UseGuards(JwtAuthGuard, WorkspaceGuard)
 *   @Get('agents')
 *   list(@CurrentWorkspace() ws: WorkspaceContext) {
 *     return this.agents.list(ws.id);
 *   }
 */
export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceContext => {
    const request = ctx.switchToHttp().getRequest<{ workspace: WorkspaceContext }>();
    return request.workspace;
  },
);
