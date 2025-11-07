import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AiServiceService } from './ai_service.service';
import { Logger } from '@nestjs/common';

@Controller()
export class AiServiceController {
  private readonly logger = new Logger(AiServiceController.name);

  constructor(private readonly aiServiceService: AiServiceService) {}

  @MessagePattern('test_event')
  handleTestEvent(@Payload() data: any) {
    this.logger.log('✅ REQUEST RECEIVED!');
    this.logger.log(data);

    // 1. Return the response
    return {
      reply: 'Hello back from ai_service!',
      dataRecieved: data,
    };
  }
}
