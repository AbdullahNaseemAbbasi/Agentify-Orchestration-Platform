import { IsUUID } from 'class-validator';

export class AttachToolDto {
  @IsUUID('4')
  toolId!: string;
}
