import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AchievementsService } from './achievements.service';

@Controller('achievements')
export class AchievementsController {
  constructor(private service: AchievementsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: any) {
    const userId = req.user?.userId;
    return this.service.listForUser(userId);
  }
}