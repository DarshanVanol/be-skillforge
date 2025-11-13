// apps/be-skillforge/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { AiServicePrismaService } from './prisma.service';

@Global()
@Module({
  providers: [AiServicePrismaService],
  exports: [AiServicePrismaService],
})
export class AiServicePrismaModule {}
