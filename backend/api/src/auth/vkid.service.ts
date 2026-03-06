import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
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

// VK обычно отдаёт телефон без "+", например "7999...."
function normalizeRuPhoneFromVk(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, '');

  // ожидаем что-то типа 7999... или 8999... или 999...
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return `+7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `+7${digits}`;
  // fallback: просто как международный
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

function parseBirthdate(bdayRaw: string | null | undefined): Date | null {
  const s = String(bdayRaw ?? '').trim();
  if (!s) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('.').map((x) => Number(x));
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

@Injectable()
export class VkIdService {
  private log = new Logger(VkIdService.name);

  constructor(private prisma: PrismaService) {}

  private clientId = process.env.VKID_CLIENT_ID ?? '';
  private clientSecret = process.env.VKID_CLIENT_SECRET ?? '';
  private defaultRedirect = process.env.VKID_DEFAULT_REDIRECT_URI ?? '';

  private async fetchUserInfo(accessToken: string) {
    // VK user_info бывает капризным по способу передачи токена — оставляем 2 варианта
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

  private mapGender(vkSex: any): 'male' | 'female' | 'unknown' {
    const n = typeof vkSex === 'string' ? Number(vkSex) : vkSex;
    if (n === 2) return 'male';
    if (n === 1) return 'female';
    return 'unknown';
  }

  /**
   * ✅ ЕДИНАЯ ФУНКЦИЯ СКЛЕЙКИ
   * 1) если есть phone -> ищем пользователя по phone
   *    - если нашли и vkId другой -> конфликт
   *    - иначе привязываем vkId к этому user.id
   * 2) если phone нет -> ищем по vkId
   * 3) если нигде нет -> создаём нового
   *
   * Поля не затираем: заполняем только если у пользователя null
   */
  private async upsertMergedUserFromVk(input: {
    vkId: string;
    name?: string | null;
    email?: string | null;
    phoneRaw?: string | null;
    avatarUrl?: string | null;
    sex?: any;
    birthday?: string | null;
  }) {
    const phone = normalizeRuPhoneFromVk(input.phoneRaw);
    const gender = this.mapGender(input.sex);
    const birthdate = parseBirthdate(input.birthday);

    // debug: какие поля реально пришли (без персональных утечек)
    this.log.warn('[VK mapped]', {
      vkId: input.vkId,
      hasPhone: !!phone,
      phoneMasked: phone ? mask(phone, 3, 2) : null,
      hasEmail: !!input.email,
      hasAvatar: !!input.avatarUrl,
      hasName: !!input.name,
      gender,
      birthday: input.birthday ?? null,
    });

    return this.prisma.$transaction(async (tx) => {
      // 1) ищем по телефону (если он есть)
      let user =
        (phone
          ? await tx.user.findUnique({
              where: { phone },
              select: {
                id: true,
                phone: true,
                vkId: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            })
          : null) ??
        // 2) иначе по vkId
        (await tx.user.findUnique({
          where: { vkId: input.vkId },
          select: {
            id: true,
            phone: true,
            vkId: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        }));

      if (user) {
        // конфликт: телефон уже у другого vk
        if (phone && user.vkId && user.vkId !== input.vkId) {
          throw new BadRequestException('PHONE_ALREADY_LINKED_TO_ANOTHER_VK');
        }

        user = await tx.user.update({
          where: { id: user.id },
          data: {
            vkId: input.vkId,
            phone: user.phone ?? phone ?? undefined,
            email: user.email ?? input.email ?? undefined,
            name: user.name ?? input.name ?? undefined,
            avatarUrl: user.avatarUrl ?? input.avatarUrl ?? undefined,
          },
          select: {
            id: true,
            phone: true,
            vkId: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            vkId: input.vkId,
            phone: phone ?? null,
            email: input.email ?? null,
            name: input.name ?? null,
            avatarUrl: input.avatarUrl ?? null,
            profile: { create: {} },
          },
          select: {
            id: true,
            phone: true,
            vkId: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        });
      }

      // профиль: обновляем аккуратно (не перетираем руками введённое)
      const existingProfile = await tx.profile.findUnique({
        where: { userId: user.id },
        select: { userId: true, gender: true, birthdate: true },
      });

      const shouldSetGender = gender !== 'unknown' && (!existingProfile || existingProfile.gender === 'unknown');
      const shouldSetBirthdate = !!birthdate && (!existingProfile || !existingProfile.birthdate);

      await tx.profile.upsert({
        where: { userId: user.id },
        update: {
          gender: shouldSetGender ? (gender as any) : undefined,
          birthdate: shouldSetBirthdate ? birthdate! : undefined,
        },
        create: {
          userId: user.id,
          gender: shouldSetGender ? (gender as any) : ('unknown' as any),
          birthdate: shouldSetBirthdate ? birthdate : null,
        },
      });

      return { user };
    });
  }

  async exchangeCode(params: { code: string; deviceId: string; codeVerifier: string; redirectUri?: string }) {
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

    const vkUserId =
      String(
        idPayload?.sub ??
          userInfo?.user?.user_id ??
          userInfo?.user_id ??
          userInfo?.user?.id ??
          userInfo?.id ??
          '',
      ).trim() || null;

    if (!vkUserId) {
      throw new BadRequestException({
        message: 'VKID: could not read user id',
        details: { idPayload, userInfo },
      });
    }

    const firstName = userInfo?.user?.first_name ?? idPayload?.given_name ?? null;
    const lastName = userInfo?.user?.last_name ?? idPayload?.family_name ?? null;
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || null;

    const email = userInfo?.user?.email ?? idPayload?.email ?? null;
    const phoneRaw = userInfo?.user?.phone ?? null;
    const avatarUrl = userInfo?.user?.avatar ?? idPayload?.picture ?? null;

    const sex = userInfo?.user?.sex ?? null;
    const birthday = userInfo?.user?.birthday ?? null;

    const { user } = await this.upsertMergedUserFromVk({
      vkId: vkUserId,
      name,
      email,
      phoneRaw,
      avatarUrl,
      sex,
      birthday,
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

    const vkUserId =
      String(userInfo?.user?.user_id ?? userInfo?.user_id ?? userInfo?.id ?? '').trim() || null;

    if (!vkUserId) {
      throw new BadRequestException({ message: 'VKID: no user_id in user_info', details: userInfo });
    }

    const firstName = userInfo?.user?.first_name ?? null;
    const lastName = userInfo?.user?.last_name ?? null;
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || null;

    const email = userInfo?.user?.email ?? null;
    const phoneRaw = userInfo?.user?.phone ?? null;
    const avatarUrl = userInfo?.user?.avatar ?? null;

    const sex = userInfo?.user?.sex ?? null;
    const birthday = userInfo?.user?.birthday ?? null;

    const { user } = await this.upsertMergedUserFromVk({
      vkId: vkUserId,
      name,
      email,
      phoneRaw,
      avatarUrl,
      sex,
      birthday,
    });

    return { user };
  }
}