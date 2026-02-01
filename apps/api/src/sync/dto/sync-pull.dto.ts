import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from "class-validator";
import { Transform, Type } from "class-transformer";

export class SyncPullQueryDto {
  @IsUUID()
  walletId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sinceSeq!: number;

  @Transform(({ value }) => value === true || value === "true" || value === "1")
  @IsBoolean()
  @IsOptional()
  useSnapshot?: boolean;
}
