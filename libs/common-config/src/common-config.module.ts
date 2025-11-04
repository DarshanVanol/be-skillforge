import { Module } from '@nestjs/common';
import { CommonConfigService } from './common-config.service';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from './config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // 3. Use the imported schema
      validationSchema,
    }),
  ],
  providers: [CommonConfigService],
  exports: [CommonConfigService],
})
export class CommonConfigModule {}
