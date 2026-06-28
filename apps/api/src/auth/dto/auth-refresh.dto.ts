import { IsOptional, IsString } from "class-validator";

export class AuthRefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsString()
  deviceId!: string;
}
