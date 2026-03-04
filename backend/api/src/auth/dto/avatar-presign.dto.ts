import { IsString } from 'class-validator';

export class AvatarPresignDto {
  @IsString()
  contentType!: string; // "image/jpeg" etc
}
