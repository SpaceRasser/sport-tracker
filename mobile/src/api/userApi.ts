import { api } from './client';

export type MeResponse = {
  user: {
    id: string;
    phone?: string | null;
    vkId?: string | null;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
    profile?: {
      userId: string;
      gender: 'male' | 'female' | 'other' | 'unknown';
      birthdate?: string | null;
      heightCm?: number | null;
      weightKg?: number | null;
      level?: 'beginner' | 'intermediate' | 'advanced' | null;
      goals?: any | null;
      healthLimitations?: Array<
        | 'cardiovascular'
        | 'musculoskeletal'
        | 'respiratory'
        | 'metabolic'
        | 'neurological'
      >;
      updatedAt?: string;
    } | null;
  };
};

export type UpdateProfilePayload = {
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthdate?: string; // "YYYY-MM-DD"
  heightCm?: number;
  weightKg?: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  goals?: any;
  healthLimitations?: Array<
    | 'cardiovascular'
    | 'musculoskeletal'
    | 'respiratory'
    | 'metabolic'
    | 'neurological'
  >;
};

export async function getMe() {
  const res = await api.get('/auth/me');
  return res.data as MeResponse;
}

export async function updateMyProfile(payload: UpdateProfilePayload) {
  const res = await api.put('/auth/me/profile', payload);
  return res.data as any;
}
