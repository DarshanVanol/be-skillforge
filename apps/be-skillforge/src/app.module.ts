import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommonConfigModule, CommonConfigService } from '@app/common-config';
import { SkillforgePrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '@app/redis';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    SkillforgePrismaModule,
    CommonConfigModule,
    RedisModule,
    TerminusModule,
    ClientsModule.registerAsync([
      {
        name: 'AI_SERVICE',
        imports: [CommonConfigModule],
        useFactory: (config: CommonConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmq.url],
            queue: config.rabbitmq.aiServiceQueue,
            queueOptions: {
              durable: config.rabbitmq.isDurableQueue,
            },
            noAck: false,
            prefetchCount: 10,
            socketOptions: {
              heartbeatIntervalInSeconds: 30,
              reconnectTimeInSeconds: 5,
            },
          },
        }),
        inject: [CommonConfigService],
      },
    ]),
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
