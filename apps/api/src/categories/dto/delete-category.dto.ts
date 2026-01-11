import { IsOptional, IsUUID } from "class-validator";

export class DeleteCategoryDto {
  @IsOptional()
  @IsUUID()
  reassignTo?: string | null;
}
