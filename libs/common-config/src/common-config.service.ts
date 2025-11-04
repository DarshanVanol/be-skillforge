import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CommonConfigService {
  // We inject the base ConfigService
  constructor(private configService: ConfigService) {}

  // --- Create your type-safe getters ---

  get env(): string {
    return this.configService.get<string>('NODE_ENV')!;
  }

  get port(): number {
    return this.configService.get<number>('PORT')!;
  }

  get aiServicePort(): number {
    return this.configService.get<number>('AI_SERVICE_PORT')!;
  }

  // You can even group related variables
  get rabbitmq() {
    const user = this.configService.get<string>('MQ_USER')!;
    const pass = this.configService.get<string>('MQ_PASS')!;
    const host = this.configService.get<string>('MQ_HOST')!;
    const port = this.configService.get<number>('MQ_PORT')!;

    const isDurableQueue =
      this.configService.get<boolean>('MQ_QUEUE_DURABLE') ??
      this.env === 'production';

    const aiServiceQueue = this.configService.get<string>(
      'MQ_AI_SERVICE_QUEUE',
    )!;

    return {
      user,
      pass,
      host,
      port,
      isDurableQueue,
      aiServiceQueue,
      // A getter for the combined URL
      get url(): string {
        return `amqp://${user}:${pass}@${host}:${port}`;
      },
    };
  }
}
