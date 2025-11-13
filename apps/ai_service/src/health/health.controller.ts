import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RedisService } from '@app/redis';
import { AiServicePrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: AiServicePrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Check PostgreSQL
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (error) {
          throw new Error(`Database health check failed: ${error}`);
        }
      },

      // Check Redis
      async () => {
        const redisHealth = await this.redis.healthCheck();
        if (redisHealth.status === 'down') {
          throw new Error('Redis health check failed');
        }
        return { redis: { status: 'up' } };
      },
    ]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    // Kubernetes readiness probe - same checks
    return this.check();
  }

  @Get('live')
  live() {
    // Kubernetes liveness probe - basic check
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
