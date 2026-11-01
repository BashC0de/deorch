import { logger } from '../logger.js';
import type { CompanionConfig } from '../config.js';

interface ServiceConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  health_path: string | null;
  expected_status: number;
  interval_seconds: number;
}

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'STOPPED' | 'UNKNOWN';

const DEGRADED_THRESHOLD_MS = 3000;

export class ServiceMonitor {
  private services: ServiceConfig[] = [];
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private running = false;

  constructor(private config: CompanionConfig) {}

  async start(): Promise<void> {
    this.running = true;
    await this.loadServices();
    for (const svc of this.services) {
      this.scheduleCheck(svc);
    }
    logger.info('service_monitor_started', { count: this.services.length });
  }

  stop(): void {
    this.running = false;
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  private async loadServices(): Promise<void> {
    try {
      const resp = await fetch(
        `${this.config.apiUrl}/api/v1/services?device_id=${this.config.deviceId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.deviceId}:${this.config.deviceSecret}`,
          },
        },
      );
      if (resp.ok) {
        this.services = (await resp.json()) as ServiceConfig[];
      }
    } catch (err) {
      logger.warn('service_monitor_load_failed', { error: String(err) });
    }
  }

  private scheduleCheck(svc: ServiceConfig): void {
    const interval = Math.max(svc.interval_seconds * 1000, 5000);
    // Run immediately, then on interval
    void this.checkService(svc);
    const timer = setInterval(() => void this.checkService(svc), interval);
    this.timers.set(svc.id, timer);
  }

  private async checkService(svc: ServiceConfig): Promise<void> {
    if (!this.running) return;

    const url = svc.health_path
      ? `http://${svc.host}:${svc.port}${svc.health_path}`
      : `http://${svc.host}:${svc.port}/`;

    let status: HealthStatus = 'UNKNOWN';
    let responseMs: number | undefined;
    let statusCode: number | undefined;
    let error: string | undefined;

    const start = Date.now();
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      responseMs = Date.now() - start;
      statusCode = resp.status;

      if (resp.status === svc.expected_status) {
        status = responseMs > DEGRADED_THRESHOLD_MS ? 'DEGRADED' : 'HEALTHY';
      } else {
        status = 'UNHEALTHY';
      }
    } catch (err) {
      responseMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        status = 'STOPPED';
      } else if (msg.includes('TimeoutError') || msg.includes('timed out')) {
        status = 'UNKNOWN';
      } else {
        status = 'UNHEALTHY';
      }
      error = msg.slice(0, 500);
    }

    // Submit to backend
    try {
      await fetch(
        `${this.config.apiUrl}/api/v1/services/${svc.id}/health`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.deviceId}:${this.config.deviceSecret}`,
          },
          body: JSON.stringify({
            status,
            response_ms: responseMs,
            status_code: statusCode ?? null,
            error: error ?? null,
          }),
        },
      );
    } catch {
      // Backend unreachable — skip this check
    }

    logger.debug('service_health_check', {
      service: svc.name,
      status,
      response_ms: responseMs,
    });
  }
}
