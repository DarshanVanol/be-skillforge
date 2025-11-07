import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs'; // 1. Import firstValueFrom

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    @Inject('AI_SERVICE') private readonly aiServiceClient: ClientProxy,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // 2. Make the method async
  @Get('test-mq')
  async testMessageQueue() {
    const testData = {
      message: 'Hello from be-skillforge!',
      timestamp: new Date(),
    };

    this.logger.log('🚀 SENDING REQUEST...');

    try {
      // 3. Use .send() and await the response
      const response = await firstValueFrom(
        this.aiServiceClient.send('test_event', testData),
      );

      this.logger.log(`📬 RESPONSE RECEIVED: ${JSON.stringify(response)}`);

      return {
        status: 'OK',
        responseFromAiService: response,
      };
    } catch (error) {
      this.logger.error(
        `Error communicating with AI_SERVICE: ${error.message}`,
        error.stack,
      );
      return { status: 'ERROR', message: error.message };
    }
  }
}
