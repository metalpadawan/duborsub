// src/health/health.controller.ts
// Simple health check endpoint — used by Railway to verify the app is up

import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    // Verify DB is reachable
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: 'connected',
    };
  }
}

// ── health.module.ts ──────────────────────────────────────────
import { Module } from '@nestjs/common';

@Module({ controllers: [HealthController] })
export class HealthModule {}

// Add HealthModule to app.module.ts imports array
