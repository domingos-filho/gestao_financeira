import { IsString, MinLength } from "class-validator";

export class UpdateWalletDto {
  @IsString()
  @MinLength(2)
  name!: string;
}
