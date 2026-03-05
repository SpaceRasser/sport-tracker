import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Express instance (для trust proxy и т.п.)
  const httpAdapter = app.getHttpAdapter();
  const instance: any = httpAdapter.getInstance?.();

  // Railway/прокси: чтобы корректно работали IP, HTTPS, cookies и т.д.
  // (типобезопасно через instance, а не app.set)
  if (instance?.set) {
    instance.set('trust proxy', 1);
  }

  // ✅ Валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ✅ CORS для мобильного приложения (Expo / React Native)
  // В RN нет браузерного CORS, но если ты дергаешь API из web/preview — пригодится.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`API listening on 0.0.0.0:${port}`);
}

bootstrap();