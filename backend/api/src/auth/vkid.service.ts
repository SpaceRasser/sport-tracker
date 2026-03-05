// backend/api/src/auth/vkid.service.ts
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

  // -------------------------
  // Phone normalization (RU + generic)
  // -------------------------
  private normalizeRuPhone(input?: string | null): string | null {
    if (!input) return null;
    const digits = String(input).replace(/\D/g, '');
    if (!digits) return null;

    if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
    if (digits.length === 11 && digits.startsWith('7')) return `+7${digits.slice(1)}`;
    if (digits.length === 10) return `+7${digits}`;

    // fallback для странных форматов
    if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  private normalizePhoneGeneric(input?: string | null): string | null {
    if (!input) return null;
    const trimmed = String(input).trim();
    const digits = trimmed.replace(/[^\d+]/g, '');
    if (!digits) return null;
    return digits.startsWith('+') ? digits : `+${digits.replace(/\D/g, '')}`;
  }

  private normalizeAnyPhone(input?: string | null): string | null {
    if (!input) return null;
    const ru = this.normalizeRuPhone(input);
    return ru ?? this.normalizePhoneGeneric(input);
  }

  // -------------------------
  // VK user_info
  // -------------------------
  private async fetchUserInfo(accessToken: string) {
    try {
      const resp = await axios.get('https://id.vk.ru/oauth2/user_info', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { client_id: this.clientId },
        timeout: 15000,
      });
      return resp.data;
    } catch {
      // fallback: query param access_token
      const resp = await axios.get('https://id.vk.ru/oauth2/user_info', {
        params: { access_token: accessToken, client_id: this.clientId },
        timeout: 15000,
      });
      return resp.data;
    }
  }

  // -------------------------
  // Core: merge/link user (phone-first, then vkId)
  // -------------------------
  private async upsertOrLinkUserFromVk(input: {
    vkId: string;
    phoneRaw?: string | null;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    // optional extra data for profile
    sex?: any;
    birthday?: string | null;
  }) {
    const vkId = String(input.vkId).trim();
    if (!vkId) throw new BadRequestException('VKID: empty vkId');

    const phone = this.normalizeAnyPhone(input.phoneRaw ?? null);
    const email = input.email ?? null;
    const name = input.name ?? null;
    const avatarUrl = input.avatarUrl ?? null;

    // 1) find by phone (priority)
    const byPhone = phone
      ? await this.prisma.user.findUnique({
          where: { phone },
          select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
        })
      : null;

    // 2) find by vkId
    const byVk = await this.prisma.user.findUnique({
      where: { vkId },
      select: { id: true, phone: true, vkId: true, name: true, email: true, avatarUrl: true },
    });

    // конфликт: phone принадлежит одному, vkId другому
    if (byPhone && byVk && byPhone.id !== byVk.id) {
      // Это редкий кейс, но в проде лучше не “сливать” данные автоматически.
      // Можно сделать ручной merge, но это риск потери данных.
      throw new BadRequestException('VK_PHONE_CONFLICT_DIFFERENT_USERS');
    }

    const target = byPhone ?? byVk;

    let user;
    if (target) {
      // если нашли по телефону и vkId уже другой — конфликт
      if (byPhone && target.vkId && target.vkId !== vkId) {
        throw new BadRequestException('PHONE_ALREADY_LINKED_TO_ANOTHER_VK');
      }

      // обновляем только пустые поля (не перетираем заполненные)
      user = await this.prisma.user.update({
        where: { id: target.id },
        data: {
          vkId: target.vkId ?? vkId, // если не было — проставим
          phone: target.phone ?? phone ?? undefined,
          email: target.email ?? email ?? undefined,
          name: target.name ?? name ?? undefined,
          avatarUrl: target.avatarUrl ?? avatarUrl ?? undefined,
        },
        select: { id: true, vkId: true, phone: true, email: true, name: true, avatarUrl: true },
      });
    } else {
      // create new
      user = await this.prisma.user.create({
        data: {
          vkId,
          phone: phone ?? null,
          email,
          name,
          avatarUrl,
          profile: { create: {} },
        },
        select: { id: true, vkId: true, phone: true, email: true, name: true, avatarUrl: true },
      });
    }

    // -------- profile (gender + birthdate) ----------
    const vkSex = input.sex;
    const sexNum = typeof vkSex === 'string' ? Number(vkSex) : vkSex;

    let gender: 'male' | 'female' | 'unknown' = 'unknown';
    if (sexNum === 2) gender = 'male';
    else if (sexNum === 1) gender = 'female';

    const bdayRaw = input.birthday ? String(input.birthday) : null;

    let birthdate: Date | null = null;
    if (bdayRaw) {
      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(bdayRaw)) {
        const d = new Date(bdayRaw);
        if (!Number.isNaN(d.getTime())) birthdate = d;
      }
      // DD.MM.YYYY
      else if (/^\d{2}\.\d{2}\.\d{4}$/.test(bdayRaw)) {
        const [dd, mm, yyyy] = bdayRaw.split('.').map((x) => Number(x));
        const d = new Date(yyyy, mm - 1, dd);
        if (!Number.isNaN(d.getTime())) birthdate = d;
      }
    }

    await this.prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        // gender можно обновить всегда (если хочешь вообще не трогать — поменяй на “только если unknown”)
        gender: gender as any,
        // birthdate НЕ затираем, если не распарсили
        birthdate: birthdate ?? undefined,
      },
      create: {
        userId: user.id,
        gender: gender as any,
        birthdate,
      },
    });

    return { user, normalizedPhone: phone };
  }

  // -------------------------
  // PKCE browser flow: code -> access_token -> user_info -> merge/link
  // -------------------------
  async exchangeCode(params: {
    code: string;
    deviceId: string;
    codeVerifier: string;
    redirectUri?: string;
  }) {
    const { code, deviceId, codeVerifier } = params;
    const redirectUri = params.redirectUri || this.defaultRedirect;

    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('VKID client credentials are not configured');
    }
    if (!redirectUri) throw new BadRequestException('redirectUri is required');
    if (!code) throw new BadRequestException('code is required');
    if (!deviceId) throw new BadRequestException('deviceId is required');
    if (!codeVerifier) throw new BadRequestException('codeVerifier is required');

    this.log.log(
      `[vk exchange] redirect=${redirectUri} code=${mask(code)} deviceId=${mask(deviceId)} verifier=${mask(
        codeVerifier,
      )}`,
    );

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
      this.log.error(`[vk token exchange failed] ${JSON.stringify(details)}`);
      throw new BadRequestException({ message: 'VKID token exchange failed', details });
    }

    if (!token?.access_token) {
      throw new BadRequestException({ message: 'VKID: no access_token returned', details: token });
    }

    const idPayload = token.id_token ? decodeJwtPayload(token.id_token) : null;

    // prefer id_token.sub, else user_info.user_id
    let vkUserId: string | null = idPayload?.sub ? String(idPayload.sub) : null;

    let userInfo: any = null;
    try {
      userInfo = await this.fetchUserInfo(token.access_token);
    } catch (e: any) {
      const details = e?.response?.data ?? e?.message ?? String(e);
      this.log.warn(`[vk user_info failed] ${JSON.stringify(details)}`);
      userInfo = null;
    }

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

    if (!vkUserId) {
      throw new BadRequestException({
        message: 'VKID: could not read user id',
        details: { idPayload, userInfo },
      });
    }

    const firstName =
      userInfo?.user?.first_name ?? userInfo?.first_name ?? idPayload?.given_name ?? idPayload?.first_name ?? '';
    const lastName =
      userInfo?.user?.last_name ?? userInfo?.last_name ?? idPayload?.family_name ?? idPayload?.last_name ?? '';
    const fullName = `${firstName} ${lastName}`.trim() || null;

    const email = userInfo?.user?.email ?? userInfo?.email ?? idPayload?.email ?? null;

    const phoneRaw = userInfo?.user?.phone ?? userInfo?.phone ?? null;

    const avatarUrl =
      userInfo?.user?.avatar ??
      userInfo?.user?.avatar_url ??
      userInfo?.avatar ??
      userInfo?.avatar_url ??
      idPayload?.picture ??
      null;

    // birthday/sex can be present depending on scopes
    const sex = userInfo?.user?.sex ?? userInfo?.sex ?? null;
    const birthday = userInfo?.user?.birthday ?? userInfo?.birthday ?? null;

    // DEBUG (safe)
    this.log.log(
      `[vk mapped] vkId=${vkUserId} phone=${phoneRaw ? mask(String(phoneRaw), 3, 2) : '—'} email=${
        email ? 'yes' : 'no'
      } avatar=${avatarUrl ? 'yes' : 'no'}`,
    );

    const { user, normalizedPhone } = await this.upsertOrLinkUserFromVk({
      vkId: String(vkUserId),
      phoneRaw: phoneRaw ? String(phoneRaw) : null,
      email,
      name: fullName,
      avatarUrl,
      sex,
      birthday: birthday ? String(birthday) : null,
    });

    this.log.log(
      `[vk linked] userId=${user.id} vkId=${user.vkId} phone=${normalizedPhone ? mask(normalizedPhone, 3, 2) : '—'}`,
    );

    return {
      user,
      vkAccessToken: token.access_token,
      vkIdToken: token.id_token ?? null,
    };
  }

  // -------------------------
  // Native flow: accessToken already provided by VK SDK
  // -------------------------
  async loginByAccessToken(accessToken: string) {
    const at = String(accessToken ?? '').trim();
    if (!at) throw new BadRequestException('accessToken is required');

    let userInfo: any;
    try {
      userInfo = await this.fetchUserInfo(at);
    } catch (e: any) {
      throw new BadRequestException({
        message: 'VKID user_info failed',
        details: e?.response?.data ?? e?.message ?? String(e),
      });
    }

    const vkUserId =
      String(userInfo?.user?.user_id ?? userInfo?.user_id ?? userInfo?.id ?? '').trim() || null;

    if (!vkUserId) {
      throw new BadRequestException({
        message: 'VKID: no user_id in user_info',
        details: userInfo,
      });
    }

    const firstName = userInfo?.user?.first_name ?? userInfo?.first_name ?? '';
    const lastName = userInfo?.user?.last_name ?? userInfo?.last_name ?? '';
    const fullName = `${firstName} ${lastName}`.trim() || null;

    const email = userInfo?.user?.email ?? userInfo?.email ?? null;
    const phoneRaw = userInfo?.user?.phone ?? userInfo?.phone ?? null;

    const avatarUrl =
      userInfo?.user?.avatar ??
      userInfo?.user?.avatar_url ??
      userInfo?.avatar ??
      userInfo?.avatar_url ??
      null;

    const sex = userInfo?.user?.sex ?? userInfo?.sex ?? null;
    const birthday = userInfo?.user?.birthday ?? userInfo?.birthday ?? null;

    this.log.log(
      `[vk native mapped] vkId=${vkUserId} phone=${phoneRaw ? mask(String(phoneRaw), 3, 2) : '—'} email=${
        email ? 'yes' : 'no'
      } avatar=${avatarUrl ? 'yes' : 'no'}`,
    );

    const { user, normalizedPhone } = await this.upsertOrLinkUserFromVk({
      vkId: String(vkUserId),
      phoneRaw: phoneRaw ? String(phoneRaw) : null,
      email,
      name: fullName,
      avatarUrl,
      sex,
      birthday: birthday ? String(birthday) : null,
    });

    this.log.log(
      `[vk native linked] userId=${user.id} vkId=${user.vkId} phone=${
        normalizedPhone ? mask(normalizedPhone, 3, 2) : '—'
      }`,
    );

    return { user };
  }
}