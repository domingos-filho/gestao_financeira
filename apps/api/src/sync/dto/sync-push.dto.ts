import { IsArray, IsString, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SyncEventDto } from "./sync-event.dto";

export class SyncPushDto {
  @IsString()
  deviceId!: string;

  @IsUUID()
  walletId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncEventDto)
  events!: SyncEventDto[];
}
