import { NestFactory } from '@nestjs/core';
import { AiServiceModule } from './ai_service.module';
import { CommonConfigService } from '@app/common-config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';



async function bootstrap() {
  const app = await NestFactory.create(AiServiceModule);
  const configService = app.get(CommonConfigService);
  const logger = new Logger(AiServiceModule.name);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [configService.rabbitmq.url],
      queue: configService.rabbitmq.aiServiceQueue,
      queueOptions: {
        durable: configService.rabbitmq.isDurableQueue,
      },
      noAck: false, // Require manual acknowledgment (matches client config)
      prefetchCount: 10, // Fair distribution: each replica gets max 10 messages
      socketOptions: {
        heartbeatIntervalInSeconds: 30, // Keep connection alive
        reconnectTimeInSeconds: 5, // Auto-reconnect if connection drops
      },
    },
  });
  app.enableShutdownHooks();

  await app.startAllMicroservices();

  await app.listen(configService.aiServicePort);

  logger.log(`AI Service is listening on port ${configService.aiServicePort}`);
}
void bootstrap();
