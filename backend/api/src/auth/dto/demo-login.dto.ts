import { IsString, MinLength } from 'class-validator';

export class DemoLoginDto {
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
