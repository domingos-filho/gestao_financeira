import { IsInt, IsUUID, Min } from "class-validator";
import { Type } from "class-transformer";

export class SyncPullQueryDto {
  @IsUUID()
  walletId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sinceSeq!: number;
}
