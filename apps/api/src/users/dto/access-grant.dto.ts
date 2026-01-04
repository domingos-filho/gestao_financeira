import { IsEmail } from "class-validator";

export class AccessGrantDto {
  @IsEmail()
  email!: string;
}
