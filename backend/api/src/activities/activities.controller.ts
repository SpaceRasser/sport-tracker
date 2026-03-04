import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('activities')
export class ActivitiesController {
  constructor(private service: ActivitiesService) {}

  // лучше под JWT, чтобы не светить справочник наружу (но можно и без guard)
  @UseGuards(JwtAuthGuard)
  @Get()
  async list() {
    const items = await this.service.list();
    return { items };
  }
}
