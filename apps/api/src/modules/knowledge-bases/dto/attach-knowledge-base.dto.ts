import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AttachKnowledgeBaseDto {
  @IsUUID('4')
  knowledgeBaseId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number;
}
