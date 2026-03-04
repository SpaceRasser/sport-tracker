import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type RegisterDeviceBody = {
  token: string; // Expo push token
  platform?: string | null; // "android" | "ios" | null
  deviceId?: string | null; // optional
};

@Controller('me')
export class MeController {
  constructor(private prisma: PrismaService) {}

  /**
   * Регистрируем/обновляем push-токен устройства
   * POST /me/device
   * body: { token, platform?, deviceId? }
   */
  @UseGuards(JwtAuthGuard)
  @Post('device')
  async registerDevice(@Req() req: any, @Body() body: RegisterDeviceBody) {
    const userId = req.user?.userId as string;
    const token = String(body?.token ?? '').trim();

    // ✅ ЛОГ входящих данных (токен не палим целиком)
    console.log('[POST /me/device] incoming', {
      userId,
      platform: body?.platform,
      deviceId: body?.deviceId,
      tokenPrefix: token ? token.slice(0, 24) : null,
      tokenLen: token?.length ?? 0,
    });

    if (!userId) throw new BadRequestException('No user');
    if (!token) throw new BadRequestException('token is required');

    const platform = String(body?.platform ?? 'android').trim() || 'android';
    const deviceId = body?.deviceId ? String(body.deviceId).trim() : null;

    const result = await this.prisma.userDevice.upsert({
      where: {
        userId_token: { userId, token },
      },
      update: {
        platform,
        deviceId,
        enabled: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        token,
        platform,
        deviceId,
        enabled: true,
        lastSeenAt: new Date(),
      },
      select: { id: true, token: true, platform: true, enabled: true },
    });

    // ✅ ЛОГ результата (токен опять же коротко)
    console.log('[POST /me/device] saved', {
      userId,
      deviceId: result.id,
      platform: result.platform,
      enabled: result.enabled,
      tokenPrefix: result.token.slice(0, 24),
      tokenLen: result.token.length,
    });
    

    return { ok: true, device: result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('devices')
  async myDevices(@Req() req: any) {
    const userId = req.user?.userId as string;
    const devices = await this.prisma.userDevice.findMany({
      where: { userId, enabled: true },
      select: {
        id: true,
        platform: true,
        enabled: true,
        lastSeenAt: true,
        token: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    return {
      ok: true,
      count: devices.length,
      devices: devices.map((d) => ({
        ...d,
        token: d.token.slice(0, 24) + '…',
      })),
    };
  }
}
