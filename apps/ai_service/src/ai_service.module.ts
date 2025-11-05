import { Module } from '@nestjs/common';
import { AiServiceController } from './ai_service.controller';
import { AiServiceService } from './ai_service.service';
import { CommonConfigModule } from '@app/common-config';
import { SkillforgePrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [CommonConfigModule, SkillforgePrismaModule],
  controllers: [AiServiceController],
  providers: [AiServiceService],
})
export class AiServiceModule {}
