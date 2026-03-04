import { IsString, IsNotEmpty } from 'class-validator';

export class VkLoginDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  // VK присылает device_id, мы принимаем deviceId и мапим в контроллере
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  codeVerifier!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}