import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ActivitiesModule } from './activities/activities.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { RecordsModule } from './records/records.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AchievementsModule } from './achievements/achievements.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { MeModule } from './me/me.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PushModule } from './push/push.module';
import { NotifyModule } from './notify/notify.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ActivitiesModule,
    WorkoutsModule,
    RecordsModule,
    AnalyticsModule,
    AchievementsModule,
    RecommendationsModule,
    MeModule,
    PushModule,
    NotifyModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
