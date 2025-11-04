import { Test, TestingModule } from '@nestjs/testing';
import { CommonConfigService } from './common-config.service';
import { ConfigModule } from '@nestjs/config';

describe('CommonConfigService', () => {
  let service: CommonConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [CommonConfigService],
    }).compile();

    service = module.get<CommonConfigService>(CommonConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
