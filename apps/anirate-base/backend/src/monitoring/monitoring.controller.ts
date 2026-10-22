import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { MonitoringService } from './monitoring.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly prisma: PrismaService,
  ) {}

  // Also a database check: a load balancer sees 503 when PostgreSQL is unreachable.
  @Get()
  async getHealth() {
    try {
      const [users, anime, comments, ratings] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.anime.count(),
        this.prisma.comment.count(),
        this.prisma.rating.count(),
      ]);
      return { ...this.monitoring.getHealthSnapshot(), datastore: { users, anime, comments, ratings } };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}

@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getOverview(): Promise<Record<string, unknown>> {
    const [users, anime, comments, ratings, refreshSessions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.anime.count(),
      this.prisma.comment.count(),
      this.prisma.rating.count(),
      this.prisma.refreshToken.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);

    return {
      health: this.monitoring.getHealthSnapshot(),
      metrics: this.monitoring.getMetricsSnapshot(),
      recentSecurityEvents: this.monitoring.getRecentSecurityEvents(),
      datastore: { users, anime, comments, ratings, refreshSessions },
    };
  }
}
