import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseCorsOrigins(value?: string) {
  // CORS_ORIGINS="https://site.com,https://admin.site.com"
  // или "*"
  const raw = (value ?? '').trim();
  if (!raw) return null;
  if (raw === '*') return '*';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // меньше шума в логах в проде (можно расширить при необходимости)
    logger:
      process.env.NODE_ENV === 'production'
        ? ['log', 'warn', 'error']
        : ['log', 'debug', 'warn', 'error', 'verbose'],
  });

  // Railway/Reverse proxy (важно для корректных IP/https)
  // Nest на Express: можно прокинуть trust proxy так
  try {
    (app as any).set('trust proxy', 1);
  } catch {}

  // ✅ DTO validation + чистка мусора
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ✅ CORS: для мобильного не обязателен, но для сайта/админки/Swagger полезен.
  // В Railway задай переменную CORS_ORIGINS:
  //   - "*" (если вообще без ограничений, не рекомендуется)
  //   - "https://sporttrackerapp.ru,https://sporttrackerapp.online"
  const origins = parseCorsOrigins(process.env.CORS_ORIGINS);
  app.enableCors({
    origin:
      origins === '*'
        ? true
        : origins
        ? origins
        : true, // если не задано — не блокируем (удобно для dev)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Если хочешь единый префикс (например /api), раскомментируй:
  // app.setGlobalPrefix('api');

  // Корректное выключение (Railway любит)
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  // Railway сам прокинет публичный URL, но нам достаточно порта
  console.log(`API listening on 0.0.0.0:${port}`);
}

bootstrap().catch((e) => {
  // чтобы в Railway было видно причину падения
  console.error('Bootstrap error:', e);
  process.exit(1);
});