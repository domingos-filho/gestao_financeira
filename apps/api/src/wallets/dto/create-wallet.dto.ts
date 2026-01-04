import { IsString, MinLength } from "class-validator";

export class CreateWalletDto {
  @IsString()
  @MinLength(2)
  name!: string;
}
