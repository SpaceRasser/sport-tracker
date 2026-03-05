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

  // --- phone normalizers (чтобы склейка с SMS работала) ---
  private normalizePhoneGeneric(input?: string | null): string | null {
    if (!input) return null;
    const trimmed = String(input).trim();
    const digits = trimmed.replace(/[^\d+]/g, '');
    if (!digits) return null;
    return digits.startsWith('+') ? digits : `+${digits.replace(/\D/g, '')}`;
  }

  private normalizeRuPhone(input?: string | null): string | null {
    if (!input) return null;
    const digits = String(input).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
    if (digits.length === 11 && digits.startsWith('7')) return `+7${digits.slice(1)}`;
    if (digits.length === 10) return `+7${digits}`;
    if (digits.length === 10 && digits.startsWith('9')) return `+7${digits}`;
    if (digits.length === 11 && digits.startsWith('9')) return `+7${digits}`;
    return null;
  }

  private normalizePhone(input?: string | null): string | null {
    const ru = this.normalizeRuPhone(input);
    return ru ?? this.normalizePhoneGeneric(input);
  }

  private async fetchUserInfo(accessToken: string) {
    // Некоторые реализации требуют client_id как параметр — добавим тоже
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

  private pickPhone(userInfo: any, idPayload: any): string | null {
    const raw =
      userInfo?.user?.phone ??
      userInfo?.user?.phone_number ??
      userInfo?.phone ??
      userInfo?.phone_number ??
      idPayload?.phone ??
      idPayload?.phone_number ??
      null;

    return this.normalizePhone(raw);
  }

  private pickAvatar(userInfo: any, idPayload: any): string | null {
    return (
      userInfo?.user?.avatar ??
      userInfo?.user?.avatar_url ??
      userInfo?.user?.photo_200 ??
      userInfo?.user?.photo_100 ??
      userInfo?.avatar ??
      userInfo?.avatar_url ??
      idPayload?.picture ??
      idPayload?.avatar ??
      null
    );
  }

  private pickName(userInfo: any, idPayload: any): string | null {
    const first =
      userInfo?.user?.first_name ??
      userInfo?.first_name ??
      idPayload?.first_name ??
      idPayload?.given_name ??
      null;

    const last =
      userInfo?.user?.last_name ??
      userInfo?.last_name ??
      idPayload?.last_name ??
      idPayload?.family_name ??
      null;

    const full = [first, last].filter(Boolean).join(' ').trim();
    return full ? full : null;
  }

  private pickVkUserId(userInfo: any, idPayload: any, tokenData: any): string | null {
    const raw =
      idPayload?.sub ??
      tokenData?.user_id ??
      tokenData?.user?.user_id ??
      tokenData?.user?.id ??
      userInfo?.user?.user_id ??
      userInfo?.user_id ??
      userInfo?.user?.id ??
      userInfo?.id ??
      null;

    const vkId = raw != null ? String(raw).trim() : '';
    return vkId ? vkId : null;
  }

  private async upsertOrMergeUser(params: {
    vkId: string;
    phone: string | null;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    gender: 'male' | 'female' | 'unknown';
    birthdate: Date | null;
  }) {
    const { vkId, phone, name, email, avatarUrl, gender, birthdate } = params;

    // 1) если есть phone — сначала ищем по phone (это и есть “склейка”)
    let user =
      (phone
        ? await this.prisma.user.findUnique({
            where: { phone },
            select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
          })
        : null) ??
      null;

    if (user) {
      // конфликт: phone уже привязан к другому vkId
      if (user.vkId && user.vkId !== vkId) {
        throw new BadRequestException('PHONE_ALREADY_LINKED_TO_ANOTHER_VK');
      }

      // привязываем vkId + заполняем пустые поля
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          vkId,
          // phone уже есть (мы по нему нашли) — не трогаем
          name: user.name ?? name ?? undefined,
          email: user.email ?? email ?? undefined,
          avatarUrl: user.avatarUrl ?? avatarUrl ?? undefined,
        },
        select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
      });
    } else {
      // 2) иначе ищем по vkId
      user = await this.prisma.user.findUnique({
        where: { vkId },
        select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
      });

      if (user) {
        // обновляем аккуратно (не затираем)
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            phone: user.phone ?? phone ?? undefined, // если раньше не было phone, а теперь появилось
            name: user.name ?? name ?? undefined,
            email: user.email ?? email ?? undefined,
            avatarUrl: user.avatarUrl ?? avatarUrl ?? undefined,
          },
          select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
        });
      } else {
        // 3) создаём нового
        user = await this.prisma.user.create({
          data: {
            vkId,
            phone: phone ?? null,
            name,
            email,
            avatarUrl,
            profile: { create: {} },
          },
          select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
        });
      }
    }

    // profile upsert (не затираем birthdate если не распарсили)
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

    return user;
  }

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
      this.log.debug(`[token] has_access=${!!token?.access_token} has_id_token=${!!token?.id_token} scope=${token?.scope ?? ''}`);
    } catch (e: any) {
      const details = e?.response?.data ?? e?.message ?? String(e);
      this.log.error(`[token] exchange failed: ${JSON.stringify(details)}`);
      throw new BadRequestException({ message: 'VKID token exchange failed', details });
    }

    if (!token?.access_token) {
      throw new BadRequestException({ message: 'VKID: no access_token returned', details: token });
    }

    const idPayload = token.id_token ? decodeJwtPayload(token.id_token) : null;

    let userInfo: any = null;
    try {
      userInfo = await this.fetchUserInfo(token.access_token);
      this.log.warn('[VK user_info raw keys]', {
        hasUser: !!userInfo?.user,
        userKeys: userInfo?.user ? Object.keys(userInfo.user) : null,
        phone: userInfo?.user?.phone ?? userInfo?.phone ?? null,
      });
    } catch (e: any) {
      this.log.warn(`[user_info] failed: ${JSON.stringify(e?.response?.data ?? e?.message ?? String(e))}`);
      userInfo = null;
    }

    const vkId = this.pickVkUserId(userInfo, idPayload, token);
    if (!vkId) throw new BadRequestException({ message: 'VKID: could not read user id', details: { idPayload, userInfo } });

    const name = this.pickName(userInfo, idPayload);
    const email = userInfo?.user?.email ?? userInfo?.email ?? idPayload?.email ?? null;
    const phone = this.pickPhone(userInfo, idPayload);
    const avatarUrl = this.pickAvatar(userInfo, idPayload);

    // gender + birthday (если есть)
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

    this.log.debug(`[mapped] vkId=${vkId} phone=${phone ?? '—'} email=${email ?? '—'} name=${name ?? '—'} avatar=${avatarUrl ? 'yes' : 'no'}`);

    const user = await this.upsertOrMergeUser({
      vkId,
      phone,
      name,
      email,
      avatarUrl,
      gender,
      birthdate,
    });

    return { user, vkAccessToken: token.access_token, vkIdToken: token.id_token ?? null };
  }

  async loginByAccessToken(accessToken: string) {
    if (!accessToken) throw new BadRequestException('accessToken is required');

    let userInfo: any;
    try {
      userInfo = await this.fetchUserInfo(accessToken);
      this.log.warn('[VK user_info raw keys]', {
        hasUser: !!userInfo?.user,
        userKeys: userInfo?.user ? Object.keys(userInfo.user) : null,
        phone: userInfo?.user?.phone ?? userInfo?.phone ?? null,
      });
    } catch (e: any) {
      throw new BadRequestException({
        message: 'VKID user_info failed',
        details: e?.response?.data ?? e?.message ?? String(e),
      });
    }

    const vkId = String(userInfo?.user?.user_id ?? userInfo?.user_id ?? userInfo?.id ?? '').trim();
    if (!vkId) {
      throw new BadRequestException({ message: 'VKID: no user_id in user_info', details: userInfo });
    }

    const idPayload = null;
    const name = this.pickName(userInfo, idPayload);
    const email = userInfo?.user?.email ?? userInfo?.email ?? null;
    const phone = this.pickPhone(userInfo, idPayload);
    const avatarUrl = this.pickAvatar(userInfo, idPayload);

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

    const user = await this.upsertOrMergeUser({
      vkId,
      phone,
      name,
      email,
      avatarUrl,
      gender,
      birthdate,
    });

    return { user };
  }
}