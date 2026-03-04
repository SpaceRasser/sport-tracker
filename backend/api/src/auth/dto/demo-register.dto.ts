import { IsOptional, IsString, MinLength } from 'class-validator';

export class DemoRegisterDto {
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
