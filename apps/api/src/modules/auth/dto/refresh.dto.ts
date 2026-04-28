import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MinLength(1, { message: 'refresh_token is required' })
  refresh_token!: string;
}
