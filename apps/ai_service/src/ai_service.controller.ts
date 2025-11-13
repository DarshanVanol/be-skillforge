import { Controller } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { AiServiceService } from './ai_service.service';
import { Logger } from '@nestjs/common';
import type { AiServiceResponse, TestEventPayload } from '@app/common';
import type { Channel, Message } from 'amqplib';

@Controller()
export class AiServiceController {
  private readonly logger = new Logger(AiServiceController.name);

  constructor(private readonly aiServiceService: AiServiceService) {}

  @MessagePattern('test_event')
  handleTestEvent(
    @Payload() data: TestEventPayload,
    @Ctx() context: RmqContext,
  ): AiServiceResponse<TestEventPayload> {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    try {
      this.logger.log('✅ REQUEST RECEIVED!');
      this.logger.log(data);

      // Process the message
      const result: AiServiceResponse<TestEventPayload> = {
        success: true,
        message: 'Test event processed successfully',
        data: {
          message: data.message,
          timestamp: data.timestamp,
        },
      };

      // Acknowledge successful processing
      channel.ack(originalMsg);
      return result;
    } catch (error) {
      this.logger.error('Error processing message:', error);
      // Reject and requeue for another replica to try
      channel.nack(originalMsg, false, true);
      throw error;
    }
  }
}
