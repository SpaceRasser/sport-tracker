import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.activityType.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        fieldsSchema: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
