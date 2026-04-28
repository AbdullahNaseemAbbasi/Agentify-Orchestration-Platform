import { ToolType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(ToolType)
  type?: ToolType;

  @IsOptional()
  @IsString()
  @Matches(/^(GET|POST|PUT|PATCH|DELETE)$/i)
  httpMethod?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  httpUrl?: string;

  @IsOptional()
  @IsObject()
  httpHeaders?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  httpBody?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  httpAuthType?: string;

  @IsOptional()
  @IsString()
  httpAuthValue?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(120_000)
  timeoutMs?: number;
}
