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

// чтобы не спалить токены в логах
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

  async exchangeCode(params: {
    code: string;
    deviceId: string;
    codeVerifier: string;
    redirectUri?: string;
  }) {
    const { code, deviceId, codeVerifier } = params;
    const redirectUri = params.redirectUri || this.defaultRedirect;

    // ===== DEBUG =====
    this.log.debug(
      `[exchangeCode] clientId=${this.clientId} redirectUri=${redirectUri} code=${mask(
        code,
      )} deviceId=${mask(deviceId)} verifier=${mask(codeVerifier)}`,
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

      // ===== DEBUG =====
      this.log.debug(
        `[token] has_access=${!!token?.access_token} has_id_token=${!!token?.id_token} scope=${token?.scope ?? ''}`,
      );
    } catch (e: any) {
      const details = e?.response?.data ?? e?.message ?? String(e);

      // ===== DEBUG =====
      this.log.error(`[token] exchange failed: ${JSON.stringify(details)}`);

      throw new BadRequestException({
        message: 'VKID token exchange failed',
        details,
      });
    }

    if (!token?.access_token) {
      throw new BadRequestException({
        message: 'VKID: no access_token returned',
        details: token,
      });
    }

    // 1) Пытаемся достать userId из id_token (самый стабильный способ)
    let vkUserId: string | null = null;
    const idPayload = token.id_token ? decodeJwtPayload(token.id_token) : null;

    // ===== DEBUG =====
    if (idPayload) {
      this.log.debug(
        `[id_token] keys=${Object.keys(idPayload).join(',')} sub=${idPayload?.sub ?? ''} email=${
          idPayload?.email ?? ''
        }`,
      );
    } else {
      this.log.debug('[id_token] missing or could not decode');
    }

    if (idPayload?.sub) vkUserId = String(idPayload.sub);

    // 2) user_info
    let userInfo: any = null;
    try {
      userInfo = await this.fetchUserInfo(token.access_token);

      // ===== DEBUG =====
      this.log.debug(
        `[user_info] keys=${userInfo ? Object.keys(userInfo).join(',') : 'null'} user.keys=${
          userInfo?.user ? Object.keys(userInfo.user).join(',') : 'null'
        }`,
      );
    } catch (e: any) {
      // ===== DEBUG =====
      this.log.warn(`[user_info] failed: ${JSON.stringify(e?.response?.data ?? e?.message ?? String(e))}`);
      userInfo = null;
    }

    // 3) Если id_token не дал id — вытаскиваем из user_info разными способами
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
        message: 'VKID: could not read user id from user_info',
        details: { idPayload, userInfo },
      });
    }

    // ===== Профиль: берём из user_info, иначе из id_token =====
    const firstName =
      userInfo?.user?.first_name ??
      userInfo?.first_name ??
      idPayload?.first_name ??
      idPayload?.given_name ??
      '';

    const lastName =
      userInfo?.user?.last_name ??
      userInfo?.last_name ??
      idPayload?.last_name ??
      idPayload?.family_name ??
      '';

    const name = `${firstName} ${lastName}`.trim() || null;

    const email = userInfo?.user?.email ?? userInfo?.email ?? idPayload?.email ?? null;
    const phone = userInfo?.user?.phone ?? userInfo?.phone ?? null;

    const avatar =
      userInfo?.user?.avatar ??
      userInfo?.user?.avatar_url ??
      userInfo?.avatar ??
      userInfo?.avatar_url ??
      idPayload?.picture ??
      idPayload?.avatar ??
      null;

    // ===== DEBUG =====
    this.log.debug(
      `[mapped] vkUserId=${vkUserId} name=${name ?? '—'} email=${email ?? '—'} phone=${phone ?? '—'} avatar=${
        avatar ? 'yes' : 'no'
      }`,
    );

    // ✅ Не затираем существующие данные null-ами
    const existing = await this.prisma.user.findUnique({
      where: { vkId: vkUserId },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });

    const user = await this.prisma.user.upsert({
      where: { vkId: vkUserId },
      update: {
        name: name ?? existing?.name ?? null,
        email: email ?? existing?.email ?? null,
        phone: phone ?? existing?.phone ?? null,
        avatarUrl: avatar ?? existing?.avatarUrl ?? null,
      },
      create: {
        vkId: vkUserId,
        name,
        email,
        phone,
        avatarUrl: avatar,
      },
      select: { id: true, vkId: true, name: true, email: true, phone: true, avatarUrl: true },
    });

    // ===========================
    // ✅ PROFILE UPSERT (gender + birthdate)
    // ===========================
    const vkSex = userInfo?.user?.sex; // может быть number или string
    const sexNum = typeof vkSex === 'string' ? Number(vkSex) : vkSex;

    let gender: 'male' | 'female' | 'unknown' = 'unknown';
    if (sexNum === 2) gender = 'male';
    else if (sexNum === 1) gender = 'female';

    const bdayRaw: string | null = userInfo?.user?.birthday ? String(userInfo.user.birthday) : null;

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

    this.log.debug(
      `[profile] sex=${vkSex ?? '—'} -> gender=${gender} birthday=${bdayRaw ?? '—'} parsed=${birthdate ? birthdate.toISOString().slice(0, 10) : '—'
      }`,
    );

    await this.prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        gender: gender as any,
        birthdate: birthdate ?? undefined, // не затираем, если не распарсили
      },
      create: {
        userId: user.id,
        gender: gender as any,
        birthdate,
      },
    });

    return { user, vkAccessToken: token.access_token, vkIdToken: token.id_token ?? null };
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
    } catch (e1: any) {
      // fallback: access_token query
      const resp = await axios.get('https://id.vk.ru/oauth2/user_info', {
        params: { access_token: accessToken, client_id: this.clientId },
        timeout: 15000,
      });
      return resp.data;
    }
  }

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

  const vkUserId = String(
    userInfo?.user?.user_id ??
    userInfo?.user_id ??
    userInfo?.id ??
    ''
  ).trim();

  if (!vkUserId) {
    throw new BadRequestException({
      message: 'VKID: no user_id in user_info',
      details: userInfo,
    });
  }

  // Профиль
  const firstName = userInfo?.user?.first_name ?? userInfo?.first_name ?? '';
  const lastName = userInfo?.user?.last_name ?? userInfo?.last_name ?? '';
  const name = `${firstName} ${lastName}`.trim() || null;

  const email = userInfo?.user?.email ?? userInfo?.email ?? null;
  const phone = userInfo?.user?.phone ?? userInfo?.phone ?? null;

  const avatar =
    userInfo?.user?.avatar ??
    userInfo?.user?.avatar_url ??
    userInfo?.avatar ??
    userInfo?.avatar_url ??
    null;

  // не затираем null-ами
  const existing = await this.prisma.user.findUnique({
    where: { vkId: vkUserId },
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
  });

  const user = await this.prisma.user.upsert({
    where: { vkId: vkUserId },
    update: {
      name: name ?? existing?.name ?? null,
      email: email ?? existing?.email ?? null,
      phone: phone ?? existing?.phone ?? null,
      avatarUrl: avatar ?? existing?.avatarUrl ?? null,
    },
    create: {
      vkId: vkUserId,
      name,
      email,
      phone,
      avatarUrl: avatar,
    },
    select: { id: true, vkId: true, name: true, email: true, phone: true, avatarUrl: true },
  });

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

  return { user };
}
}