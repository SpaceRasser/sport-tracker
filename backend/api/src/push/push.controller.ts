import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PushService } from './push.service';

type TestPushBody = {
  title?: string;
  body?: string;
  data?: Record<string, any>;
};

@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  /**
   * Тестовый пуш самому себе.
   * POST /push/test
   * body: { title?, body?, data? }
   */
  @UseGuards(JwtAuthGuard)
  @Post('test')
  async test(@Req() req: any, @Body() body: TestPushBody) {
    const userId = req.user?.userId as string;

    return this.push.sendToUser(userId, {
      title: body?.title ?? 'SportTracker',
      body: body?.body ?? 'Тестовое уведомление',
      data: body?.data ?? { kind: 'test' },
    });
  }
}