import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { UserRole } from "@gf/shared";

export class UpdateManagedUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  walletId?: string;
}
