import { Module } from '@nestjs/common';
import { AiServiceController } from './ai_service.controller';
import { AiServiceService } from './ai_service.service';
import { CommonConfigModule } from '@app/common-config';
import { AiServicePrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '@app/redis';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    CommonConfigModule,
    AiServicePrismaModule,
    RedisModule,
    TerminusModule,
  ],
  controllers: [AiServiceController, HealthController],
  providers: [AiServiceService],
})
export class AiServiceModule {}
