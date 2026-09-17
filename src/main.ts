import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: [
    'http://localhost:5173',
    'https://lets-dunjo.vercel.app',
    ],
    Credentials: true,
  });

  await app.listen(8080);

  console.log('DUNJO Backend running on http://localhost:8080');
}

bootstrap();