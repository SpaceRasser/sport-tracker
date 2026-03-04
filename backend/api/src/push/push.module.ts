// backend/api/src/push/push.module.ts
import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushController } from './push.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}