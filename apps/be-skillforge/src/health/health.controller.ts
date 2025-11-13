import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { RedisService } from '@app/redis';
import { SkillforgePrismaService } from '../../prisma/prisma.service';
import { Transport } from '@nestjs/microservices';
import { CommonConfigService } from '@app/common-config';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private microservice: MicroserviceHealthIndicator,
    private prisma: SkillforgePrismaService,
    private redis: RedisService,
    private config: CommonConfigService,
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

      // Check RabbitMQ
      () =>
        this.microservice.pingCheck('rabbitmq', {
          transport: Transport.RMQ,
          options: {
            urls: [this.config.rabbitmq.url],
          },
        }),
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
