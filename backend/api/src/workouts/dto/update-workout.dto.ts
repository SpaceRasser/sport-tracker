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

export class UpdateWorkoutMetricDto {
  @IsString()
  @MaxLength(64)
  key!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;
}

export class UpdateWorkoutDto {
  @IsOptional()
  @IsUUID()
  activityTypeId?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsInt()
  durationSec?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // если передали metrics — считаем что это новый полный список
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWorkoutMetricDto)
  metrics?: UpdateWorkoutMetricDto[];
}