import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AiServiceService } from './ai_service.service';
import { Logger } from '@nestjs/common';
import type { AiServiceResponse, TestEventPayload } from '@app/common';
@Controller()
export class AiServiceController {
  private readonly logger = new Logger(AiServiceController.name);

  constructor(private readonly aiServiceService: AiServiceService) {}

  @MessagePattern('test_event')
  handleTestEvent(
    @Payload() data: TestEventPayload,
  ): AiServiceResponse<TestEventPayload> {
    this.logger.log('✅ REQUEST RECEIVED!');
    this.logger.log(data);

    // 1. Return the response
    return {
      success: true,
      message: 'Test event processed successfully',
      data: {
        message: data.message,
        timestamp: data.timestamp,
      },
    };
  }
}
