import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../storage/minio.service';

type Tokens = { accessToken: string; refreshToken: string };

type VkLoginInput = {
  code: string;
  deviceId: string;
  codeVerifier: string;
  redirectUri: string;
};

type SmsRequestInput = {
  phone: string;
};

type SmsVerifyInput = {
  phone: string;
  code: string;
};

type DemoRegisterInput = {
  phone: string;
  password: string;
  name?: string;
};

type DemoLoginInput = {
  phone: string;
  password: string;
};

@Injectable()
export class AuthService {
  private accessSecret: string;
  private refreshSecret: string;
  private accessTtl: number;
  private refreshTtl: number;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private redisService: RedisService,
    private prisma: PrismaService,
    private minio: MinioService,
  ) {
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET')!;
    this.refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET')!;
    this.accessTtl = Number(
      this.config.get<string>('ACCESS_TTL_SECONDS') ?? 900,
    );
    this.refreshTtl = Number(
      this.config.get<string>('REFRESH_TTL_SECONDS') ?? 2592000,
    );
  }

  // =========================
  // Tokens (JWT + refresh in Redis)
  // =========================

  async issueTokens(userId: string): Promise<Tokens> {
    const tokenId = uuidv4();

    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      { secret: this.accessSecret, expiresIn: this.accessTtl },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, tid: tokenId },
      { secret: this.refreshSecret, expiresIn: this.refreshTtl },
    );

    await this.redisService.redis.set(
      `refresh:${userId}:${tokenId}`,
      '1',
      'EX',
      this.refreshTtl,
    );

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshSecret,
      });
      const userId = payload.sub as string;
      const tokenId = payload.tid as string;

      const exists = await this.redisService.redis.get(
        `refresh:${userId}:${tokenId}`,
      );
      if (!exists) throw new UnauthorizedException('Refresh revoked');

      const accessToken = await this.jwt.signAsync(
        { sub: userId },
        { secret: this.accessSecret, expiresIn: this.accessTtl },
      );

      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshSecret,
      });
      const userId = payload.sub as string;
      const tokenId = payload.tid as string;
      await this.redisService.redis.del(`refresh:${userId}:${tokenId}`);
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }

  // =========================
  // Demo auth (phone + password, stored in PostgreSQL)
  // =========================

  private normalizePhoneGeneric(input?: string): string | null {
    if (!input) return null;
    const trimmed = String(input).trim();
    const digits = trimmed.replace(/[^\d+]/g, '');
    if (!digits) return null;
    // Не навязываем RU-формат здесь — просто сохраняем как есть (но без мусора).
    // Рекомендация: на фронте приводить к единому формату (например +7...).
    return digits.startsWith('+') ? digits : `+${digits.replace(/\D/g, '')}`;
  }

  async demoCheckPhone(phoneRaw: string) {
    const phone = this.normalizePhoneGeneric(phoneRaw);
    if (!phone) throw new BadRequestException('Invalid phone');

    const user = await this.prisma.user.findUnique({ where: { phone } });
    return { exists: !!user };
  }

  async demoRegister(input: DemoRegisterInput) {
    const phone = this.normalizePhoneGeneric(input?.phone);
    const password = String(input?.password ?? '');

    if (!phone) throw new BadRequestException('Invalid phone');
    if (password.length < 6)
      throw new BadRequestException('Password too short (min 6)');

    const exists = await this.prisma.user.findUnique({ where: { phone } });
    if (exists) throw new BadRequestException('PHONE_ALREADY_REGISTERED');

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        phone,
        passwordHash,
        name: input?.name ?? null,
        profile: { create: {} },
      },
      select: { id: true, phone: true, name: true, avatarUrl: true },
    });

    const tokens = await this.issueTokens(user.id);

    return {
      user,
      ...tokens,
    };
  }

  async demoLogin(input: DemoLoginInput) {
    const phone = this.normalizePhoneGeneric(input?.phone);
    const password = String(input?.password ?? '');

    if (!phone) throw new BadRequestException('Invalid phone');
    if (password.length < 6)
      throw new BadRequestException('Invalid credentials');

    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash)
      throw new UnauthorizedException('INVALID_CREDENTIALS');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('INVALID_CREDENTIALS');

    const tokens = await this.issueTokens(user.id);

    // passwordHash наружу не отдаём
    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  }

  // =========================
  // SMS (sms.ru)
  // =========================

  private rateLimit(message = 'Too many requests') {
    throw new HttpException(message, 429);
  }

  private normalizeRuPhone(input?: string): string | null {
    if (!input) return null;
    const digits = String(input).replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('8'))
      return `+7${digits.slice(1)}`;
    if (digits.length === 11 && digits.startsWith('7'))
      return `+7${digits.slice(1)}`;
    if (digits.length === 10) return `+7${digits}`;

    if (digits.length === 10 && digits.startsWith('9')) return `+7${digits}`;
    if (digits.length === 11 && digits.startsWith('9')) return `+7${digits}`;

    return null;
  }

  private hashSmsCode(phone: string, code: string): string {
    const pepper = this.config.get<string>('SMS_CODE_PEPPER') ?? 'pepper';
    return createHash('sha256')
      .update(`${pepper}:${phone}:${code}`)
      .digest('hex');
  }

  async smsRequestCode(input: SmsRequestInput) {
    const phone = this.normalizeRuPhone(input?.phone);
    if (!phone)
      throw new BadRequestException('Invalid phone. Expected RU phone number');

    const apiId = this.config.get<string>('SMSRU_API_ID');
    if (!apiId) throw new BadRequestException('SMSRU_API_ID is not set');

    const ttl = Number(this.config.get<string>('SMS_CODE_TTL_SECONDS') ?? 300);
    const resend = Number(
      this.config.get<string>('SMS_CODE_RESEND_SECONDS') ?? 60,
    );
    const maxAttempts = Number(
      this.config.get<string>('SMS_CODE_MAX_ATTEMPTS') ?? 5,
    );

    const lockKey = `sms:lock:${phone}`;
    const locked = await this.redisService.redis.get(lockKey);
    if (locked) this.rateLimit('Try again later');

    const code = String(Math.floor(100000 + Math.random() * 900000));

    const codeKey = `sms:code:${phone}`;
    const attemptsKey = `sms:attempts:${phone}`;

    await this.redisService.redis.set(
      codeKey,
      this.hashSmsCode(phone, code),
      'EX',
      ttl,
    );
    await this.redisService.redis.set(attemptsKey, '0', 'EX', ttl);
    await this.redisService.redis.set(lockKey, '1', 'EX', resend);

    const test = String(this.config.get<string>('SMSRU_TEST') ?? '0');
    const msg = `Код входа: ${code}. Действует ${Math.ceil(ttl / 60)} мин.`;
    const toDigits = phone.replace(/\D/g, ''); // "7xxxxxxxxxx"
    const tokenRes = await fetch('https://sms.ru/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_id: apiId,
        to: toDigits,
        msg,
        json: '1',
        test,
      }),
    });

    const data: any = await tokenRes.json().catch(() => null);
    console.log('sms.ru response:', JSON.stringify(data));

    if (!tokenRes.ok || !data || data.status !== 'OK') {
      await this.redisService.redis.del(codeKey);
      await this.redisService.redis.del(attemptsKey);
      throw new BadRequestException(data?.status_text ?? 'SMS send failed');
    }

    if (test === '1') {
      return { ok: true, phone, testCode: code, maxAttempts };
    }
    return { ok: true, phone, maxAttempts };
  }

  async smsVerifyCode(input: SmsVerifyInput) {
    const phone = this.normalizeRuPhone(input?.phone);
    const code = String(input?.code ?? '').replace(/\D/g, '');

    if (!phone) throw new BadRequestException('Invalid phone');
    if (!/^\d{6}$/.test(code)) throw new BadRequestException('Invalid code');

    const ttl = Number(this.config.get<string>('SMS_CODE_TTL_SECONDS') ?? 300);
    const maxAttempts = Number(
      this.config.get<string>('SMS_CODE_MAX_ATTEMPTS') ?? 5,
    );

    const codeKey = `sms:code:${phone}`;
    const attemptsKey = `sms:attempts:${phone}`;

    const expectedHash = await this.redisService.redis.get(codeKey);
    if (!expectedHash) throw new UnauthorizedException('Code expired');

    const attempts = Number(
      (await this.redisService.redis.get(attemptsKey)) ?? '0',
    );
    if (attempts >= maxAttempts) this.rateLimit('Too many attempts');

    const gotHash = this.hashSmsCode(phone, code);
    if (gotHash !== expectedHash) {
      await this.redisService.redis.incr(attemptsKey);
      await this.redisService.redis.expire(attemptsKey, ttl);
      throw new UnauthorizedException('Wrong code');
    }

    // ✅ код верный — чистим redis
    await this.redisService.redis.del(codeKey);
    await this.redisService.redis.del(attemptsKey);

    // ✅ 1) ищем пользователя по phone
    let user = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        vkId: true,
      },
    });

    // ✅ 2) если нет — создаём нового (UUID) + пустой профиль
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          profile: { create: {} },
        },
        select: {
          id: true,
          phone: true,
          name: true,
          avatarUrl: true,
          vkId: true,
        },
      });
    }

    // ✅ 3) выдаём токены по UUID
    const tokens = await this.issueTokens(user.id);

    return {
      user,
      ...tokens,
    };
  }

  /**
   * VK ID OAuth 2.1 login (for Expo Go flow)
   *
   * Requires env:
   *  VKID_CLIENT_ID=...
   *  VKID_CLIENT_SECRET=...   (your "Защищённый ключ")
   */
  async vkLogin(input: VkLoginInput) {
    const { code, deviceId, codeVerifier, redirectUri } = input;

    if (!code || !deviceId || !codeVerifier || !redirectUri) {
      throw new BadRequestException(
        'code, deviceId, codeVerifier, redirectUri are required',
      );
    }

    const clientId = this.config.get<string>('VKID_CLIENT_ID');
    const clientSecret = this.config.get<string>('VKID_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'VKID_CLIENT_ID / VKID_CLIENT_SECRET are not set',
      );
    }

    // 1) exchange code -> access_token
    const tokenRes = await fetch('https://id.vk.ru/oauth2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        device_id: deviceId,
      }),
    });

    const tokenData: any = await tokenRes.json().catch(() => null);

    if (!tokenRes.ok || !tokenData || tokenData?.error) {
      throw new UnauthorizedException(
        tokenData?.error_description ??
          tokenData?.error ??
          'VKID token exchange failed',
      );
    }

    const vkAccessToken: string | undefined = tokenData.access_token;
    if (!vkAccessToken)
      throw new UnauthorizedException('VKID did not return access_token');

    // 2) user_info (name/avatar + maybe phone if VK ever gives it)
    let userInfo: any = null;
    try {
      const infoRes = await fetch('https://id.vk.ru/oauth2/user_info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: vkAccessToken }),
      });
      userInfo = await infoRes.json().catch(() => null);
    } catch {
      userInfo = null;
    }

    // 3) stable VK id
    const stableVkIdRaw =
      tokenData.user_id ??
      tokenData?.user?.user_id ??
      tokenData?.user?.id ??
      userInfo?.user?.user_id ??
      userInfo?.user_id ??
      userInfo?.user?.id;

    const vkId = stableVkIdRaw != null ? String(stableVkIdRaw) : null;
    if (!vkId) throw new UnauthorizedException('VKID did not return user id');

    // 4) normalize profile fields from VK
    const firstName = userInfo?.user?.first_name ?? null;
    const lastName = userInfo?.user?.last_name ?? null;

    const nameFromVk =
      [firstName, lastName].filter(Boolean).join(' ').trim() || null;

    // VK может отдавать разные поля аватарки (оставим несколько вариантов)
    const avatarFromVk =
      userInfo?.user?.avatar ??
      userInfo?.user?.photo_200 ??
      userInfo?.user?.photo_100 ??
      null;

    // VK phone может появиться только при соответствующих разрешениях (часто его нет)
    const phoneFromVkRaw =
      userInfo?.user?.phone ??
      userInfo?.user?.phone_number ??
      userInfo?.phone ??
      null;

    // если вдруг VK вернул телефон — попробуем привести к RU формату (иначе оставим как generic +digits)
    let phoneFromVk: string | null = null;
    if (phoneFromVkRaw) {
      const ru = this.normalizeRuPhone(String(phoneFromVkRaw));
      phoneFromVk = ru ?? this.normalizePhoneGeneric(String(phoneFromVkRaw));
    }

    // 5) Upsert/merge logic:
    // - если есть phone (когда VK даст) и в БД уже есть user с таким phone => привязываем vkId к нему
    // - иначе ищем по vkId
    // - иначе создаём
    let user =
      (phoneFromVk
        ? await this.prisma.user.findUnique({
            where: { phone: phoneFromVk },
            select: {
              id: true,
              phone: true,
              vkId: true,
              name: true,
              avatarUrl: true,
            },
          })
        : null) ??
      (await this.prisma.user.findUnique({
        where: { vkId },
        select: {
          id: true,
          phone: true,
          vkId: true,
          name: true,
          avatarUrl: true,
        },
      }));

    if (user) {
      // Если нашли по телефону, но у него уже другой vkId — это конфликт аккаунтов.
      // Для прода лучше не “склеивать молча”, а вернуть ошибку.
      if (phoneFromVk && user.vkId && user.vkId !== vkId) {
        throw new BadRequestException('PHONE_ALREADY_LINKED_TO_ANOTHER_VK');
      }

      // обновляем привязку и данные (аккуратно: имя/аватар только если есть что ставить)
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          vkId, // привязываем/обновляем
          // телефон не трогаем, если он уже есть; если пустой и VK дал — заполним
          phone: user.phone ?? phoneFromVk ?? undefined,
          // имя: если у юзера пусто, а VK дал — заполним
          name: user.name ?? nameFromVk ?? undefined,
          // аватар: если у юзера пусто, а VK дал — заполним
          avatarUrl: user.avatarUrl ?? avatarFromVk ?? undefined,
        },
        select: {
          id: true,
          phone: true,
          vkId: true,
          name: true,
          avatarUrl: true,
        },
      });
    } else {
      // создаём нового пользователя (UUID) + пустой профиль
      user = await this.prisma.user.create({
        data: {
          vkId,
          phone: phoneFromVk ?? null,
          name: nameFromVk,
          avatarUrl: avatarFromVk,
          profile: { create: {} },
        },
        select: {
          id: true,
          phone: true,
          vkId: true,
          name: true,
          avatarUrl: true,
        },
      });
    }

    // 6) tokens уже по UUID (важно для всех твоих сервисов, где userId uuid)
    const tokens = await this.issueTokens(user.id);

    return {
      user: {
        ...user,
        // опционально можешь отдавать эти поля фронту (не обязательно)
        firstName,
        lastName,
      },
      ...tokens,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        vkId: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    if (!user) throw new UnauthorizedException('USER_NOT_FOUND');
    return { user };
  }

  async updateMyProfile(userId: string, dto: any) {
    // birthdate: строку в Date (если прислали)
    const birthdate = dto.birthdate ? new Date(dto.birthdate) : undefined;
    const healthLimitations: string[] | undefined = Array.isArray(
      dto.healthLimitations,
    )
      ? Array.from(
          new Set(
            dto.healthLimitations.filter((item: unknown): item is string =>
              typeof item === 'string',
            ),
          ),
        )
      : undefined;

    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: {
        gender: dto.gender ?? undefined,
        birthdate,
        heightCm: dto.heightCm ?? undefined,
        weightKg: dto.weightKg ?? undefined,
        level: dto.level ?? undefined,
        goals: dto.goals ?? undefined,
        healthLimitations,
      },
      create: {
        userId,
        gender: dto.gender ?? 'unknown',
        birthdate,
        heightCm: dto.heightCm ?? null,
        weightKg: dto.weightKg ?? null,
        level: dto.level ?? null,
        goals: dto.goals ?? null,
        healthLimitations: healthLimitations ?? [],
      },
    });

    // возвращаем user+profile
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        profile: true,
      },
    });

    return { user, profile };
  }

  async updateMe(userId: string, dto: { name?: string; avatarUrl?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name ?? undefined,
        avatarUrl: dto.avatarUrl ?? undefined,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        avatarUrl: true,
        profile: true,
      },
    });

    return { user };
  }

  async presignMyAvatar(userId: string, contentType: string) {
    if (!contentType?.startsWith('image/')) {
      throw new BadRequestException('Only image/* content types allowed');
    }

    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/jpeg'
            ? 'jpg'
            : 'jpg';

    const objectKey = `avatars/${userId}/${Date.now()}.${ext}`;

    const { uploadUrl, publicUrl } = await this.minio.presignPutObject({
      objectKey,
      contentType,
      expiresInSec: 90,
    });

    return { uploadUrl, publicUrl, objectKey };
  }
}
