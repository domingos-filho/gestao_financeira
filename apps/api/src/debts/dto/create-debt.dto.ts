import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateDebtDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(1)
  principalCents!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  interestRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPaymentCents?: number;

  @IsISO8601()
  startedAt!: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
