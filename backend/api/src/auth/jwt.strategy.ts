import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  userId?: string;  // ✅ мы кладём это в токен
  sub?: string;     // иногда используют sub
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET, // ✅ твой секрет
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.userId ?? payload.sub;
    if (!userId) throw new UnauthorizedException('Invalid token payload');
    return { userId };
  }
}