import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsController } from './records.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RecordsController],
})
export class RecordsModule {}