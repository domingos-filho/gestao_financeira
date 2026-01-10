import { IsEmail, IsEnum, IsString, IsUUID, MinLength } from "class-validator";
import { UserRole } from "@gf/shared";

export class CreateManagedUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsUUID()
  walletId!: string;
}
