import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceWithRole, WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtUser): Promise<WorkspaceWithRole[]> {
    return this.workspacesService.findAllForUser(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceWithRole> {
    return this.workspacesService.create(dto, user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<WorkspaceWithRole> {
    return this.workspacesService.findByIdForUser(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceWithRole> {
    return this.workspacesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.workspacesService.softDelete(id, user.id);
  }
}
