import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { VkIdService } from './vkid.service';
import { VkLoginDto } from './dto/vk-login.dto';

@Controller('auth')
export class VkIdController {
  constructor(private vkid: VkIdService, private jwt: JwtService) {}

  // старый browser-flow (code + deviceId + verifier)
  @Post('vk-id/exchange')
  async exchange(@Body() body: VkLoginDto) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.deviceId) throw new BadRequestException('deviceId is required');
    if (!body?.codeVerifier) throw new BadRequestException('codeVerifier is required');
    if (!body?.redirectUri) throw new BadRequestException('redirectUri is required');

    const { user } = await this.vkid.exchangeCode({
      code: body.code,
      deviceId: body.deviceId,
      codeVerifier: body.codeVerifier,
      redirectUri: body.redirectUri,
    });

    const accessToken = await this.jwt.signAsync({ userId: user.id });
    return { accessToken, user };
  }

  // ✅ новый native-flow (VKID SDK отдаёт accessToken напрямую)
  @Post('vk-id/token')
  async token(@Body() body: { accessToken: string }) {
    const accessTokenVk = String(body?.accessToken ?? '').trim();
    if (!accessTokenVk) throw new BadRequestException('accessToken is required');

    const { user } = await this.vkid.loginByAccessToken(accessTokenVk);

    const accessToken = await this.jwt.signAsync({ userId: user.id });
    return { accessToken, user };
  }
}