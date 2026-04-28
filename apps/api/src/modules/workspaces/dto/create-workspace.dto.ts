import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  /**
   * Optional URL-friendly identifier. If omitted, the service derives one
   * from the name and ensures uniqueness.
   */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: 'slug must be lowercase letters, digits, and hyphens (cannot start/end with hyphen)',
  })
  slug?: string;
}
