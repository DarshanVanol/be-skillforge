import { NestFactory } from '@nestjs/core';
import { AiServiceModule } from './ai_service.module';
import { CommonConfigService } from '@app/common-config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AiServiceModule);
  const configService = app.get(CommonConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [configService.rabbitmq.url],
      queue: 'ai_service_queue',
      queueOptions: {
        durable: false,
      },
    },
  });

  await app.startAllMicroservices();

  await app.listen(configService.aiServicePort);

  console.log(`AI Service is listening on port ${configService.aiServicePort}`);
}
bootstrap();
