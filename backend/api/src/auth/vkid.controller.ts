import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { VkIdService } from './vkid.service';
import { VkLoginDto } from './dto/vk-login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class VkIdController {
  constructor(private vkid: VkIdService, private auth: AuthService) {}

  // browser-flow (PKCE): code + deviceId + verifier
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

    // ✅ ЕДИНЫЙ ФОРМАТ ТОКЕНОВ ДЛЯ ВСЕХ ЛОГИНОВ
    const tokens = await this.auth.issueTokens(user.id);
    return { user, ...tokens };
  }

  // native-flow (VKID SDK): accessToken напрямую
  @Post('vk-id/token')
  async token(@Body() body: { accessToken: string }) {
    const accessTokenVk = String(body?.accessToken ?? '').trim();
    if (!accessTokenVk) throw new BadRequestException('accessToken is required');

    const { user } = await this.vkid.loginByAccessToken(accessTokenVk);

    // ✅ ЕДИНЫЙ ФОРМАТ ТОКЕНОВ ДЛЯ ВСЕХ ЛОГИНОВ
    const tokens = await this.auth.issueTokens(user.id);
    return { user, ...tokens };
  }
}