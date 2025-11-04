import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommonConfigModule, CommonConfigService } from '@app/common-config';

@Module({
  imports: [
    CommonConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'AI_SERVICE',
        imports: [CommonConfigModule],
        useFactory: (config: CommonConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmq.url],
            queue: 'ai_service_queue',
            queueOptions: {
              durable: false,
            },
          },
        }),
        inject: [CommonConfigService],
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
