// src/main.ts — FINAL version with all global middleware wired up
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app    = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Security headers ──────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc:  ["'self'"],
          imgSrc:      ["'self'", 'data:', 'https:'],
          scriptSrc:   ["'self'"],
          styleSrc:    ["'self'", "'unsafe-inline'"],
          connectSrc:  ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      referrerPolicy:  { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false, // allow image loading
    }),
  );

  // ── Cookie parser (httpOnly refresh token) ────────────────
  app.use(cookieParser());

  // ── CORS ─────────────────────────────────────────────────
  app.enableCors({
    origin:         config.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials:    true,
    methods:        ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Global prefix ─────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Global pipes ──────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:              true,
      forbidNonWhitelisted:   true,
      transform:              true,
      transformOptions:       { enableImplicitConversion: true },
      stopAtFirstError:       false,
    }),
  );

  // ── Global filters & interceptors ─────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Graceful shutdown ─────────────────────────────────────
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`API running → http://0.0.0.0:${port}/api/v1`);
}

bootstrap();
