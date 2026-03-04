import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class AnalyticsProgressDto {
  @IsUUID()
  activityTypeId!: string;

  @IsString()
  metricKey!: string;

  @IsOptional()
  @IsIn(['7', '30', '90'])
  days?: '7' | '30' | '90';
}