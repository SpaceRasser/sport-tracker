import { IsString } from 'class-validator';

export class DemoCheckPhoneDto {
  @IsString()
  phone!: string;
}
