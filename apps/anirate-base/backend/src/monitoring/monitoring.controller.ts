import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DataService } from '../data/data.service';
import { MonitoringService } from './monitoring.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly data: DataService,
  ) {}

  @Get()
  getHealth() {
    return {
      ...this.monitoring.getHealthSnapshot(),
      datastore: {
        users: this.data.users.length,
        anime: this.data.anime.length,
        comments: this.data.comments.length,
        ratings: this.data.ratings.length,
      },
    };
  }
}

@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly data: DataService,
  ) {}

  @Get()
  getOverview(): Record<string, unknown> {
    return {
      health: this.monitoring.getHealthSnapshot(),
      metrics: this.monitoring.getMetricsSnapshot(),
      recentSecurityEvents: this.monitoring.getRecentSecurityEvents(),
      datastore: {
        users: this.data.users.length,
        anime: this.data.anime.length,
        comments: this.data.comments.length,
        ratings: this.data.ratings.length,
        refreshSessions: this.data.refreshTokens.filter((token) => !token.revokedAt).length,
      },
    };
  }
}
