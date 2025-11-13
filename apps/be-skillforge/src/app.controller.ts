import type { TestEventPayload, AiServiceResponse } from '@app/common';
import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    @Inject('AI_SERVICE') private readonly aiServiceClient: ClientProxy,
  ) {}

  @Get('test-mq')
  async testMessageQueue() {
    const testData: TestEventPayload = {
      message: 'Hello from be-skillforge!',
      timestamp: new Date(),
    };

    this.logger.log('🚀 SENDING REQUEST...');

    try {
      const response = await firstValueFrom(
        this.aiServiceClient.send<AiServiceResponse<TestEventPayload>>(
          'test_event',
          testData,
        ),
      );

      this.logger.log(`📬 RESPONSE RECEIVED: ${JSON.stringify(response)}`);

      return {
        status: 'OK',
        responseFromAiService: response,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error communicating with AI_SERVICE: ${err.message}`,
        err.stack,
      );
      return { status: 'ERROR', message: err.message };
    }
  }
}
