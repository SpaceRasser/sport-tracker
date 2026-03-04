import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SignOptions } from 'jsonwebtoken';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisService } from './redis.service';
import { JwtStrategy } from './jwt.strategy';
import { StorageModule } from '../storage/storage.module';

import { VkIdController } from './vkid.controller';
import { VkIdService } from './vkid.service';

@Module({
  imports: [
    // ConfigModule isGlobal=true у тебя уже есть в AppModule,
    // но для registerAsync безопасно указать его в imports.
    ConfigModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret) {
          // чтобы больше никогда не ловить "secretOrPrivateKey must have a value"
          throw new Error('JWT_ACCESS_SECRET is missing in environment');
        }

        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as SignOptions['expiresIn'],
          },
        };
      },
    }),

    StorageModule,
  ],
  controllers: [AuthController, VkIdController],
  providers: [AuthService, RedisService, JwtStrategy, VkIdService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}