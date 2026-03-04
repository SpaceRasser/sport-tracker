import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { ListWorkoutsDto } from './dto/list-workouts.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';

@Controller('workouts')
export class WorkoutsController {
  constructor(private service: WorkoutsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateWorkoutDto) {
    const userId = req.user?.userId;
    return this.service.create(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: any, @Query() q: ListWorkoutsDto) {
    const userId = req.user?.userId;
    return this.service.list(userId, q);
  }

  @UseGuards(JwtAuthGuard)
@Get('latest')
async latest(@Req() req: any) {
  const userId = req.user?.userId;
  return this.service.latest(userId);
}

    @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.userId;
    const res = await this.service.getById(userId, id);
    return res ?? { workout: null };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.userId;
    return this.service.remove(userId, id);
  }
  

  @UseGuards(JwtAuthGuard)
@Put(':id')
async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateWorkoutDto) {
  const userId = req.user?.userId;
  return this.service.update(userId, id, dto);
}


}
