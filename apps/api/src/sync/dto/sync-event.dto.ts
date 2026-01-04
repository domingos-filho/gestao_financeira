import { IsDefined, IsEnum, IsString, IsUUID } from "class-validator";
import { SyncEventType } from "@gf/shared";

export class SyncEventDto {
  @IsUUID()
  eventId!: string;

  @IsUUID()
  walletId!: string;

  @IsUUID()
  userId!: string;

  @IsString()
  deviceId!: string;

  @IsEnum(SyncEventType)
  eventType!: SyncEventType;

  @IsDefined()
  payload!: unknown;
}
