import { Test, TestingModule } from '@nestjs/testing';
import { AiServiceService } from './ai_service.service';

describe('AiServiceService', () => {
  let service: AiServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiServiceService],
    }).compile();

    service = module.get<AiServiceService>(AiServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });
});
