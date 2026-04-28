import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTextDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  /** Inline raw text. Capped at ~1 MiB so requests stay reasonable. */
  @IsString()
  @MinLength(1)
  @MaxLength(1_000_000)
  text!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
