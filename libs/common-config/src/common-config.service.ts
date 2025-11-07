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
        return `amqps://${user}:${pass}@${host}:${port}`;
      },
    };
  }

  get redis() {
    const host = this.configService.get<string>('REDIS_HOST')!;
    const port = this.configService.get<number>('REDIS_PORT')!;
    const password = this.configService.get<string>('REDIS_PASSWORD')!;
    const tls = this.configService.get<boolean>('REDIS_TLS')!;

    return {
      host,
      port,
      password,
      tls,
      // A getter for the combined URL
      get url(): string {
        const authPart = password ? `:${password}@` : '';
        const tlsPart = tls ? '?tls=true' : '';
        return `redis://${authPart}${host}:${port}${tlsPart}`;
      },
    };
  }
}
