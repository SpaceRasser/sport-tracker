import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

enum UserLevel {
  beginner = 'beginner',
  intermediate = 'intermediate',
  advanced = 'advanced',
}

enum Gender {
  male = 'male',
  female = 'female',
  other = 'other',
  unknown = 'unknown',
}

export enum HealthLimitation {
  cardiovascular = 'cardiovascular',
  musculoskeletal = 'musculoskeletal',
  respiratory = 'respiratory',
  metabolic = 'metabolic',
  neurological = 'neurological',
}

export class UpdateProfileDto {
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  /**
   * В Prisma у тебя birthdate = DateTime? @db.Date
   * На клиенте шлём ISO строку "YYYY-MM-DD" (или полный ISO) — Prisma переварит Date.
   */
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @IsOptional()
  @Min(50)
  @Max(260)
  heightCm?: number;

  @IsOptional()
  @Min(20)
  @Max(400)
  weightKg?: number;

  @IsOptional()
  @IsEnum(UserLevel)
  level?: UserLevel;

  @IsOptional()
  @IsObject()
  goals?: any;

  @IsOptional()
  @IsArray()
  @IsEnum(HealthLimitation, { each: true })
  healthLimitations?: HealthLimitation[];
}
