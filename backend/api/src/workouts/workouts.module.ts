import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { AchievementsModule } from '../achievements/achievements.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, AchievementsModule, PushModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
})
export class WorkoutsModule {}