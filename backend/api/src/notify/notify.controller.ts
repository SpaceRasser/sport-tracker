import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notify')
export class NotifyController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async get(@Req() req: any) {
    const userId = req.user.userId as string;
    const s =
      (await this.prisma.notificationSettings.findUnique({ where: { userId } })) ??
      (await this.prisma.notificationSettings.create({ data: { userId } }));
    return { ok: true, settings: s };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('settings')
  async patch(@Req() req: any, @Body() body: any) {
    const userId = req.user.userId as string;

    const s = await this.prisma.notificationSettings.upsert({
      where: { userId },
      update: {
        timezone: body.timezone ?? undefined,

        enabled: body.enabled ?? undefined,
        inactivityEnabled: body.inactivityEnabled ?? undefined,
        inactivityDays: body.inactivityDays ?? undefined,

        workoutTimeEnabled: body.workoutTimeEnabled ?? undefined,
        workoutTimeLocal: body.workoutTimeLocal ?? undefined,
        workoutDaysMask: body.workoutDaysMask ?? undefined,

        recommendationsEnabled: body.recommendationsEnabled ?? undefined,
      },
      create: {
        userId,
        timezone: body.timezone ?? null,
      },
    });

    return { ok: true, settings: s };
  }
}