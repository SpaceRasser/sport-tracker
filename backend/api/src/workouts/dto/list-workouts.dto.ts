import { IsInt, IsOptional, IsUUID, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ListWorkoutsDto {
  @IsOptional()
  @IsUUID()
  activityTypeId?: string;

  // ISO date string in ms (we parse as Date)
  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  // удобный быстрый фильтр (не обязательно)
  @IsOptional()
  @IsIn(['week', 'month', 'all'])
  period?: 'week' | 'month' | 'all' = 'all';
}
