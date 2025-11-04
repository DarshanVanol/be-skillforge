import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommonConfigService } from '@app/common-config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger(AppModule.name);
  const app = await NestFactory.create(AppModule);
  const configService = app.get(CommonConfigService);
  await app.listen(configService.port, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();
