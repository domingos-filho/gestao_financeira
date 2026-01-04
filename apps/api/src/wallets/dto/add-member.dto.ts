import { IsEmail, IsEnum } from "class-validator";
import { WalletRole } from "@gf/shared";

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(WalletRole)
  role!: WalletRole;
}
