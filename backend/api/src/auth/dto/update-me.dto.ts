import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
