import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateRunDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  input!: string;

  /** Existing thread to continue. Omit to start a fresh thread. */
  @IsOptional()
  @IsUUID('4')
  threadId?: string;

  /**
   * When true, the run is queued and executed by a worker — the
   * response returns immediately with a PENDING run to poll. When
   * false/omitted the run executes synchronously.
   */
  @IsOptional()
  @IsBoolean()
  async?: boolean;
}
