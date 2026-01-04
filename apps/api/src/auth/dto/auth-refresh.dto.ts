import { IsString } from "class-validator";

export class AuthRefreshDto {
  @IsString()
  refreshToken!: string;

  @IsString()
  deviceId!: string;
}
