import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsProgressDto } from './dto/progress.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('progress')
  async progress(@Req() req: any, @Query() q: AnalyticsProgressDto) {
    const userId = req.user?.userId;
    return this.service.progress(userId, q);
  }

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async summary(@Req() req: any) {
    const userId = req.user?.userId;
    return this.service.summary(userId);
  }
}