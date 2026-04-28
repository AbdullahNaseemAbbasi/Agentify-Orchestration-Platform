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

export class CreateToolDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'name must start with a letter or underscore and contain only letters, digits, underscores',
  })
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description!: string;

  /** JSON Schema describing the function arguments LLM must produce. */
  @IsObject()
  parameters!: Record<string, unknown>;

  @IsOptional()
  @IsEnum(ToolType)
  type?: ToolType;

  // ----- HTTP tool fields -----

  @IsOptional()
  @IsString()
  @Matches(/^(GET|POST|PUT|PATCH|DELETE)$/i, {
    message: 'httpMethod must be one of GET, POST, PUT, PATCH, DELETE',
  })
  httpMethod?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'httpUrl must be a valid URL' })
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

  // ----- Built-in / MCP placeholders (filled in later weeks) -----

  @IsOptional()
  @IsString()
  builtInType?: string;

  @IsOptional()
  @IsString()
  mcpServerUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(120_000)
  timeoutMs?: number;
}
