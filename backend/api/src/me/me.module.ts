// backend/api/src/me/me.module.ts
import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
})
export class MeModule {}