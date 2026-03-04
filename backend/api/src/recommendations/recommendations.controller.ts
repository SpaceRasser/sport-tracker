import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private service: RecommendationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: any) {
    const userId = req.user?.userId;
    return this.service.getForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/dismiss')
  async dismiss(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.userId;
    return this.service.dismiss(userId, id);
  }
}