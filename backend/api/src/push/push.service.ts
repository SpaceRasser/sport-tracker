import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ExpoPushMessage = {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default';
  priority?: 'default' | 'normal' | 'high';
};

@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Отправка пуша конкретному пользователю (все его устройства)
   */
  async sendToUser(userId: string, payload: { title?: string; body: string; data?: any }) {
    const devices = await this.prisma.userDevice.findMany({
      where: { userId, enabled: true },
      select: { token: true }, // <-- token, НЕ expoPushToken
      take: 50, // чтобы не словить лимиты/мусор
    });

    const tokens = devices
      .map((d) => d.token)
      .filter((t) => typeof t === 'string' && t.length > 10);

    if (tokens.length === 0) {
      this.log.debug(`No push tokens for user ${userId}`);
      return { ok: true, sent: 0 };
    }

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: 'default',
      priority: 'high',
    }));

    return this.sendExpo(messages);
  }

  /**
   * Реальная отправка через Expo Push API
   */
  private async sendExpo(messages: ExpoPushMessage[]) {
    // Expo лимит: до 100 сообщений в одном запросе — разобьём чанками
    const chunks: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

    let sent = 0;
    for (const chunk of chunks) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });

      const data: any = await res.json().catch(() => null);
      if (!res.ok) {
        this.log.warn(`Expo push failed: ${res.status} ${JSON.stringify(data)}`);
        continue;
      }

      // tickets: [{status:"ok"|"error", ...}]
      const tickets = data?.data ?? [];
      sent += tickets.filter((t: any) => t?.status === 'ok').length;

      // Если Expo вернул "DeviceNotRegistered" — можно отключать токен
      for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered') {
          const badToken = chunk[i]?.to;
          if (badToken) {
            await this.prisma.userDevice.updateMany({
              where: { token: badToken },
              data: { enabled: false },
            });
          }
        }
      }
    }

    return { ok: true, sent };
  }
}