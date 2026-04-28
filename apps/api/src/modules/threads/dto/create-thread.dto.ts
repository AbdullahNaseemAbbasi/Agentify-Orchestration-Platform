import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateThreadDto {
  @IsUUID('4')
  agentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /** Client-supplied identifier for correlating threads with external systems. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
