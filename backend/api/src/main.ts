import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ включает class-validator для DTO + режет лишние поля
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // удаляет поля, которых нет в DTO
      forbidNonWhitelisted: true, // кидает 400, если прислали лишние поля
      transform: true,            // приводит типы (например строки -> числа, если возможно)
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on http://0.0.0.0:${port}`);
}
bootstrap();
