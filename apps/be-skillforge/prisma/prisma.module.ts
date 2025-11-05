// apps/be-skillforge/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { SkillforgePrismaService } from './prisma.service';

@Global()
@Module({
  providers: [SkillforgePrismaService],
  exports: [SkillforgePrismaService],
})
export class SkillforgePrismaModule {}
