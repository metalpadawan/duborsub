import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

type SecuritySeverity = 'info' | 'warning' | 'critical';

interface RouteMetric {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  lastDurationMs: number;
  lastStatusCode: number;
  lastSeenAt: Date;
}

interface SecurityEvent {
  id: string;
  type: string;
  severity: SecuritySeverity;
  message: string;
  userId: string | null;
  ipAddress: string | null;
  path: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

@Injectable()
export class MonitoringService {
  private readonly startedAt = Date.now();
  private readonly routeMetrics = new Map<string, RouteMetric>();
  private readonly securityEvents: SecurityEvent[] = [];
  private totalRequests = 0;
  private totalErrors = 0;

  trackRequest(input: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  }) {
    this.totalRequests += 1;
    if (input.statusCode >= 400) {
      this.totalErrors += 1;
    }

    const key = `${input.method} ${input.path}`;
    const existing = this.routeMetrics.get(key);

    if (existing) {
      existing.count += 1;
      existing.totalDurationMs += input.durationMs;
      existing.lastDurationMs = input.durationMs;
      existing.lastStatusCode = input.statusCode;
      existing.lastSeenAt = new Date();
      if (input.statusCode >= 400) {
        existing.errorCount += 1;
      }
      return;
    }

    this.routeMetrics.set(key, {
      count: 1,
      errorCount: input.statusCode >= 400 ? 1 : 0,
      totalDurationMs: input.durationMs,
      lastDurationMs: input.durationMs,
      lastStatusCode: input.statusCode,
      lastSeenAt: new Date(),
    });
  }

  recordSecurityEvent(event: {
    type: string;
    severity: SecuritySeverity;
    message: string;
    userId?: string | null;
    ipAddress?: string | null;
    path?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    this.securityEvents.unshift({
      id: randomUUID(),
      type: event.type,
      severity: event.severity,
      message: event.message,
      userId: event.userId ?? null,
      ipAddress: event.ipAddress ?? null,
      path: event.path ?? null,
      metadata: event.metadata ?? null,
      createdAt: new Date(),
    });

    if (this.securityEvents.length > 200) {
      this.securityEvents.length = 200;
    }
  }

  getHealthSnapshot() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  getMetricsSnapshot() {
    const routes = Array.from(this.routeMetrics.entries())
      .map(([route, metric]) => ({
        route,
        count: metric.count,
        errorCount: metric.errorCount,
        averageDurationMs: Number((metric.totalDurationMs / metric.count).toFixed(2)),
        lastDurationMs: metric.lastDurationMs,
        lastStatusCode: metric.lastStatusCode,
        lastSeenAt: metric.lastSeenAt,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 25);

    const securityEventTotals = this.securityEvents.reduce<Record<string, number>>((totals, event) => {
      totals[event.type] = (totals[event.type] ?? 0) + 1;
      return totals;
    }, {});

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      totals: {
        requests: this.totalRequests,
        errors: this.totalErrors,
        errorRate: this.totalRequests === 0 ? 0 : Number((this.totalErrors / this.totalRequests).toFixed(4)),
      },
      routes,
      securityEventTotals,
    };
  }

  getRecentSecurityEvents(limit = 50) {
    return this.securityEvents.slice(0, limit);
  }
}
