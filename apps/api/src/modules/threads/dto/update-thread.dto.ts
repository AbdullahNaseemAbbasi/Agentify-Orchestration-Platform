import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
