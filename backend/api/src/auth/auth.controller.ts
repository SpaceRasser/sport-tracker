import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { DemoCheckPhoneDto } from './dto/demo-check.dto';
import { DemoRegisterDto } from './dto/demo-register.dto';
import { DemoLoginDto } from './dto/demo-login.dto';
import { Body, Controller, Get, Post, Req, Put, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { AvatarPresignDto } from './dto/avatar-presign.dto';



type VkLoginBody = {
  code: string;
  deviceId: string;
  codeVerifier: string;
  redirectUri: string;
};

type SmsRequestBody = {
  phone: string;
};

type SmsVerifyBody = {
  phone: string;
  code: string;
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /**
   * Старый "один демо-пользователь" — оставь, если хочешь как быстрый вход.
   * Но теперь у нас есть нормальный demo flow по телефону/паролю ниже.
   */
  @Post('demo')
  async demo() {
    const userId = 'demo-user-1';
    const tokens = await this.auth.issueTokens(userId);
    return { user: { id: userId, name: 'Demo User' }, ...tokens };
  }

  /**
   * Demo auth (phone+password) — шаг 1:
   * проверка, существует ли пользователь с таким телефоном
   * Body: { phone }
   * Response: { exists: boolean }
   */
  @Post('demo/check-phone')
  async demoCheckPhone(@Body() dto: DemoCheckPhoneDto) {
    return this.auth.demoCheckPhone(dto.phone);
  }

  /**
   * Demo auth (phone+password) — регистрация
   * Body: { phone, password, name? }
   * Response: { accessToken, refreshToken, user }
   */
  @Post('demo/register')
  async demoRegister(@Body() dto: DemoRegisterDto) {
    return this.auth.demoRegister(dto);
  }

  /**
   * Demo auth (phone+password) — логин
   * Body: { phone, password }
   * Response: { accessToken, refreshToken, user }
   */
  @Post('demo/login')
  async demoLogin(@Body() dto: DemoLoginDto) {
    return this.auth.demoLogin(dto);
  }

  /**
   * VK ID OAuth (Expo Go)
   * Body:
   *  - code
   *  - deviceId
   *  - codeVerifier
   *  - redirectUri (https://auth.expo.io/@rasser31/sport-tracker)
   */
  @Post('vk')
  async vk(@Body() body: VkLoginBody) {
    const { code, deviceId, codeVerifier, redirectUri } = body;
    return this.auth.vkLogin({ code, deviceId, codeVerifier, redirectUri });
  }

  /**
   * SMS login — request code (sms.ru)
   * Body:
   *  - phone: "+79991234567" / "89991234567" / "9991234567"
   */
  @Post('sms/request')
  async smsRequest(@Body() body: SmsRequestBody) {
    return this.auth.smsRequestCode(body);
  }

  /**
   * SMS login — verify code
   * Body:
   *  - phone
   *  - code: "123456"
   */
  @Post('sms/verify')
  async smsVerify(@Body() body: SmsVerifyBody) {
    return this.auth.smsVerifyCode(body);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  async logout(@Body() body: { refreshToken: string }) {
    return this.auth.logout(body.refreshToken);
  }

    @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const userId = (req as any).user?.userId as string;
    return this.auth.me(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/profile')
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const userId = (req as any).user?.userId as string;
    return this.auth.updateMyProfile(userId, dto);
  }

    @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateMeDto) {
    const userId = req.user?.userId as string;
    return this.auth.updateMe(userId, dto);
  }

    @UseGuards(JwtAuthGuard)
  @Post('me/avatar/presign')
  async presignAvatar(@Req() req: any, @Body() dto: AvatarPresignDto) {
    const userId = req.user?.userId as string;
    return this.auth.presignMyAvatar(userId, dto.contentType);
  }


}
