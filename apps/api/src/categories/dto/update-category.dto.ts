import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength, Min } from "class-validator";
import { CategoryType } from "@gf/shared";

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{6})$/)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
