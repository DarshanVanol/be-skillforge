import { Controller, Get } from '@nestjs/common';
import { RedisService } from './redis.service';

@Controller('health/redis')
export class RedisHealthController {
  constructor(private readonly redisService: RedisService) {}

  @Get()
  async check() {
    return this.redisService.healthCheck();
  }
}
