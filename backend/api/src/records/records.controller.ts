import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('records')
export class RecordsController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: any) {
    const userId = req.user?.userId;

    const rows = await this.prisma.personalRecord.findMany({
      where: { userId },
      orderBy: [{ activityTypeId: 'asc' }, { metricKey: 'asc' }],
      include: {
        activityType: { select: { id: true, code: true, name: true } },
        workout: { select: { id: true, startedAt: true } },
      },
    });

    const items = rows.map((r) => ({
      id: r.id,
      metricKey: r.metricKey,
      bestValueNum: Number(r.bestValueNum),
      achievedAt: r.achievedAt,
      workoutId: r.workoutId,
      activityType: r.activityType,
    }));

    return { items };
  }
}