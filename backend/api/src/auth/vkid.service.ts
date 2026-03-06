import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string; // JWT
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const norm = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function mask(s: string | null | undefined, keepStart = 6, keepEnd = 4) {
  const v = String(s ?? '');
  if (!v) return '';
  if (v.length <= keepStart + keepEnd + 3) return v;
  return `${v.slice(0, keepStart)}...${v.slice(-keepEnd)}`;
}

@Injectable()
export class VkIdService {
  private log = new Logger(VkIdService.name);

  constructor(private prisma: PrismaService) {}

  private clientId = process.env.VKID_CLIENT_ID ?? '';
  private clientSecret = process.env.VKID_CLIENT_SECRET ?? '';
  private defaultRedirect = process.env.VKID_DEFAULT_REDIRECT_URI ?? '';

  // --- phone normalization (копия логики, чтобы не тащить AuthService внутрь) ---
  private normalizePhoneGeneric(input?: string): string | null {
    if (!input) return null;
    const trimmed = String(input).trim();
    const digits = trimmed.replace(/[^\d+]/g, '');
    if (!digits) return null;
    return digits.startsWith('+') ? digits : `+${digits.replace(/\D/g, '')}`;
  }

  private normalizeRuPhone(input?: string): string | null {
    if (!input) return null;
    const digits = String(input).replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
    if (digits.length === 11 && digits.startsWith('7')) return `+7${digits.slice(1)}`;
    if (digits.length === 10) return `+7${digits}`;

    if (digits.length === 10 && digits.startsWith('9')) return `+7${digits}`;
    if (digits.length === 11 && digits.startsWith('9')) return `+7${digits}`;

    return null;
  }

  private normalizeVkPhone(raw: any): string | null {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;

    const ru = this.normalizeRuPhone(s);
    return ru ?? this.normalizePhoneGeneric(s);
  }

  private pickUserId(token: TokenResponse, userInfo: any): string | null {
    const idPayload = token.id_token ? decodeJwtPayload(token.id_token) : null;

    let vkUserId: string | null = null;
    if (idPayload?.sub) vkUserId = String(idPayload.sub);

    if (!vkUserId && userInfo) {
      vkUserId =
        String(
          userInfo?.user?.user_id ??
            userInfo?.user_id ??
            userInfo?.user?.id ??
            userInfo?.id ??
            userInfo?.sub ??
            '',
        ).trim() || null;
    }
    return vkUserId;
  }

  private async fetchUserInfo(accessToken: string) {
    // Некоторые реализации требуют client_id как параметр
    try {
      const resp = await axios.get('https://id.vk.ru/oauth2/user_info', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { client_id: this.clientId },
        timeout: 15000,
      });
      return resp.data;
    } catch {
      const resp = await axios.get('https://id.vk.ru/oauth2/user_info', {
        params: { access_token: accessToken, client_id: this.clientId },
        timeout: 15000,
      });
      return resp.data;
    }
  }

  // ✅ единая функция: найти/создать юзера с “склейкой” по телефону
  private async upsertUserWithMerge(params: {
    vkId: string;
    phoneRaw: any;
    emailRaw: any;
    nameRaw: string | null;
    avatarRaw: string | null;
  }) {
    const { vkId, phoneRaw, emailRaw, nameRaw, avatarRaw } = params;

    const phone = this.normalizeVkPhone(phoneRaw); // может быть null
    const email = emailRaw ? String(emailRaw).trim() : null;
    const name = nameRaw?.trim() ? nameRaw.trim() : null;
    const avatar = avatarRaw?.trim() ? avatarRaw.trim() : null;

    // 1) если телефон есть — сначала ищем по телефону
    let user =
      (phone
        ? await this.prisma.user.findUnique({
            where: { phone },
            select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
          })
        : null) ??
      // 2) иначе/дополнительно — ищем по vkId
      (await this.prisma.user.findUnique({
        where: { vkId },
        select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
      }));

    if (user) {
      // Конфликт: нашли по телефону, но у юзера уже другой vkId
      if (phone && user.vkId && user.vkId !== vkId) {
        throw new BadRequestException('PHONE_ALREADY_LINKED_TO_ANOTHER_VK');
      }

      // Обновляем “мягко”: только если в БД пусто
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          vkId,
          phone: user.phone ?? phone ?? undefined,
          email: user.email ?? email ?? undefined,
          name: user.name ?? name ?? undefined,
          avatarUrl: user.avatarUrl ?? avatar ?? undefined,
        },
        select: { id: true, phone: true, vkId: true, email: true, name: true, avatarUrl: true },
      });

      return { user, phoneWasPresent: !!phone };
    }

    // Не нашли вообще — создаём нового
    const created = await this.prisma.user.create({
      data: {
        vkId,
        phone: phone ?? null,
        email,
        name,
        avatarUrl: avatar,
        profile: { create: {} }, // важно
      },
      select: { id: true, phone: true, vkId: true, email: true, name: true, avatarUrl: true },
    });

    return { user: created, phoneWasPresent: !!phone };
  }

  // =========================
  // PKCE exchange flow
  // =========================
  async exchangeCode(params: {
    code: string;
    deviceId: string;
    codeVerifier: string;
    redirectUri?: string;
  }) {
    const { code, deviceId, codeVerifier } = params;
    const redirectUri = params.redirectUri || this.defaultRedirect;

    this.log.debug(
      `[exchangeCode] clientId=${this.clientId} redirectUri=${redirectUri} code=${mask(code)} deviceId=${mask(
        deviceId,
      )} verifier=${mask(codeVerifier)}`,
    );

    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('VKID client credentials are not configured');
    }
    if (!redirectUri) throw new BadRequestException('redirectUri is required');
    if (!code) throw new BadRequestException('code is required');
    if (!deviceId) throw new BadRequestException('deviceId is required');
    if (!codeVerifier) throw new BadRequestException('codeVerifier is required');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      code,
      device_id: deviceId,
      code_verifier: codeVerifier,
    });

    let token: TokenResponse;
    try {
      const resp = await axios.post('https://id.vk.ru/oauth2/auth', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });
      token = resp.data;
    } catch (e: any) {
      const details = e?.response?.data ?? e?.message ?? String(e);
      this.log.error(`[token] exchange failed: ${JSON.stringify(details)}`);
      throw new BadRequestException({ message: 'VKID token exchange failed', details });
    }

    if (!token?.access_token) {
      throw new BadRequestException({ message: 'VKID: no access_token returned', details: token });
    }

    let userInfo: any = null;
    try {
      userInfo = await this.fetchUserInfo(token.access_token);
    } catch (e: any) {
      this.log.warn(`[user_info] failed: ${JSON.stringify(e?.response?.data ?? e?.message ?? String(e))}`);
      userInfo = null;
    }

    const vkUserId = this.pickUserId(token, userInfo);
    if (!vkUserId) {
      throw new BadRequestException({ message: 'VKID: could not read user id', details: { token, userInfo } });
    }

    // Поля
    const firstName = userInfo?.user?.first_name ?? '';
    const lastName = userInfo?.user?.last_name ?? '';
    const name = `${firstName} ${lastName}`.trim() || null;

    const email = userInfo?.user?.email ?? userInfo?.email ?? null;
    const phone = userInfo?.user?.phone ?? userInfo?.phone ?? null;

    const avatar =
      userInfo?.user?.avatar ??
      userInfo?.user?.avatar_url ??
      userInfo?.avatar ??
      userInfo?.avatar_url ??
      null;

    // Лог для отладки телефона
    this.log.warn('[VK user_info raw keys]', {
      hasUser: !!userInfo?.user,
      userKeys: userInfo?.user ? Object.keys(userInfo.user) : null,
      phone: userInfo?.user?.phone ?? userInfo?.phone ?? null,
    });

    const { user, phoneWasPresent } = await this.upsertUserWithMerge({
      vkId: String(vkUserId),
      phoneRaw: phone,
      emailRaw: email,
      nameRaw: name,
      avatarRaw: avatar,
    });

    // profile gender/birthday (как у тебя было)
    const vkSex = userInfo?.user?.sex;
    const sexNum = typeof vkSex === 'string' ? Number(vkSex) : vkSex;
    let gender: 'male' | 'female' | 'unknown' = 'unknown';
    if (sexNum === 2) gender = 'male';
    else if (sexNum === 1) gender = 'female';

    const bdayRaw: string | null = userInfo?.user?.birthday ? String(userInfo.user.birthday) : null;
    let birthdate: Date | null = null;
    if (bdayRaw) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(bdayRaw)) {
        const d = new Date(bdayRaw);
        if (!Number.isNaN(d.getTime())) birthdate = d;
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(bdayRaw)) {
        const [dd, mm, yyyy] = bdayRaw.split('.').map((x) => Number(x));
        const d = new Date(yyyy, mm - 1, dd);
        if (!Number.isNaN(d.getTime())) birthdate = d;
      }
    }

    await this.prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        gender: gender as any,
        birthdate: birthdate ?? undefined,
      },
      create: {
        userId: user.id,
        gender: gender as any,
        birthdate,
      },
    });

    this.log.warn('[VK mapped]', {
      vkId: user.vkId,
      hasPhone: phoneWasPresent,
      phoneMasked: user.phone ? mask(user.phone, 2, 2) : null,
      hasEmail: !!user.email,
      hasAvatar: !!user.avatarUrl,
      hasName: !!user.name,
      gender,
      birthday: bdayRaw ?? null,
    });

    return { user, vkAccessToken: token.access_token, vkIdToken: token.id_token ?? null };
  }

  // =========================
  // Native flow: access token -> user_info -> merge
  // =========================
  async loginByAccessToken(accessToken: string) {
    if (!accessToken) throw new BadRequestException('accessToken is required');

    let userInfo: any;
    try {
      userInfo = await this.fetchUserInfo(accessToken);
    } catch (e: any) {
      throw new BadRequestException({
        message: 'VKID user_info failed',
        details: e?.response?.data ?? e?.message ?? String(e),
      });
    }

    this.log.warn('[VK user_info raw keys]', {
      hasUser: !!userInfo?.user,
      userKeys: userInfo?.user ? Object.keys(userInfo.user) : null,
      phone: userInfo?.user?.phone ?? userInfo?.phone ?? null,
    });

    const vkUserId = String(userInfo?.user?.user_id ?? userInfo?.user_id ?? userInfo?.id ?? '').trim();
    if (!vkUserId) {
      throw new BadRequestException({ message: 'VKID: no user_id in user_info', details: userInfo });
    }

    const firstName = userInfo?.user?.first_name ?? '';
    const lastName = userInfo?.user?.last_name ?? '';
    const name = `${firstName} ${lastName}`.trim() || null;

    const email = userInfo?.user?.email ?? userInfo?.email ?? null;
    const phone = userInfo?.user?.phone ?? userInfo?.phone ?? null;

    const avatar =
      userInfo?.user?.avatar ??
      userInfo?.user?.avatar_url ??
      userInfo?.avatar ??
      userInfo?.avatar_url ??
      null;

    const { user, phoneWasPresent } = await this.upsertUserWithMerge({
      vkId: vkUserId,
      phoneRaw: phone,
      emailRaw: email,
      nameRaw: name,
      avatarRaw: avatar,
    });

    // profile gender/birthday
    const vkSex = userInfo?.user?.sex;
    const sexNum = typeof vkSex === 'string' ? Number(vkSex) : vkSex;
    let gender: 'male' | 'female' | 'unknown' = 'unknown';
    if (sexNum === 2) gender = 'male';
    else if (sexNum === 1) gender = 'female';

    const bdayRaw: string | null = userInfo?.user?.birthday ? String(userInfo.user.birthday) : null;
    let birthdate: Date | null = null;
    if (bdayRaw) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(bdayRaw)) {
        const d = new Date(bdayRaw);
        if (!Number.isNaN(d.getTime())) birthdate = d;
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(bdayRaw)) {
        const [dd, mm, yyyy] = bdayRaw.split('.').map((x) => Number(x));
        const d = new Date(yyyy, mm - 1, dd);
        if (!Number.isNaN(d.getTime())) birthdate = d;
      }
    }

    await this.prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        gender: gender as any,
        birthdate: birthdate ?? undefined,
      },
      create: {
        userId: user.id,
        gender: gender as any,
        birthdate,
      },
    });

    this.log.warn('[VK mapped]', {
      vkId: user.vkId,
      hasPhone: phoneWasPresent,
      phoneMasked: user.phone ? mask(user.phone, 2, 2) : null,
      hasEmail: !!user.email,
      hasAvatar: !!user.avatarUrl,
      hasName: !!user.name,
      gender,
      birthday: bdayRaw ?? null,
    });

    return { user };
  }
}