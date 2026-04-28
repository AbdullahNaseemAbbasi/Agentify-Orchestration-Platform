import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateRunDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  input!: string;

  /** Existing thread to continue. Omit to start a fresh thread. */
  @IsOptional()
  @IsUUID('4')
  threadId?: string;
}
