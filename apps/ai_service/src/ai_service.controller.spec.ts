import { Test, TestingModule } from '@nestjs/testing';
import { AiServiceController } from './ai_service.controller';
import { AiServiceService } from './ai_service.service';
import { Logger } from '@nestjs/common';

describe('AiServiceController', () => {
  let controller: AiServiceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiServiceController],
      providers: [AiServiceService],
    }).compile();

    controller = module.get<AiServiceController>(AiServiceController);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleTestEvent', () => {
    it('should process test event and return success response', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const testData = {
        message: 'Hello from be-skillforge!',
        timestamp: new Date(),
      };

      const result = controller.handleTestEvent(testData);

      expect(result).toEqual({
        success: true,
        message: 'Test event processed successfully',
        data: {
          message: testData.message,
          timestamp: testData.timestamp,
        },
      });
      expect(logSpy).toHaveBeenCalled();
    });

    it('should handle different message content', () => {
      const testData = {
        message: 'Different message',
        timestamp: new Date('2025-01-01'),
      };

      const result = controller.handleTestEvent(testData);

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Different message');
      expect(result.data.timestamp).toEqual(new Date('2025-01-01'));
    });
  });
});
