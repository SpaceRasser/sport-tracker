import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { NotifyService } from './notify.service';
import { NotifyController } from './notify.controller';

@Module({
  imports: [PrismaModule, PushModule],
  controllers: [NotifyController],
  providers: [NotifyService],
})
export class NotifyModule {}