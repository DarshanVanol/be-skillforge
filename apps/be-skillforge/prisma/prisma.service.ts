// apps/be-skillforge/src/prisma/prisma.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@data-access/ai-client';

@Injectable()
export class SkillforgePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SkillforgePrismaService.name);

  // Connect to the database when the NestJS module initializes
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Skillforge DB connected successfully.');
  }

  // Disconnect from the database when the NestJS application shuts down
  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Skillforge DB disconnected.');
  }
}
