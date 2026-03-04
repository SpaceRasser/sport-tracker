import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkoutMetricDto {
  @IsString()
  @MaxLength(64)
  key!: string;

  // valueNum у тебя Decimal(12,4) — в API принимаем number
  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;
}

export class CreateWorkoutDto {
  @IsUUID()
  activityTypeId!: string;

  @IsDateString()
  startedAt!: string;

  @IsOptional()
  @IsInt()
  durationSec?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutMetricDto)
  metrics!: CreateWorkoutMetricDto[];
}
