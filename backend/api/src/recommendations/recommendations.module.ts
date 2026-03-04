import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, PushModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}