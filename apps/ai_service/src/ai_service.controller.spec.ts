import { Test, TestingModule } from '@nestjs/testing';
import { AiServiceController } from './ai_service.controller';
import { AiServiceService } from './ai_service.service';
import { Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

describe('AiServiceController', () => {
  let controller: AiServiceController;

  const mockChannel = {
    ack: jest.fn(),
    nack: jest.fn(),
  };

  const mockMessage = {
    content: Buffer.from('test'),
  };

  const mockRmqContext = {
    getChannelRef: jest.fn(() => mockChannel),
    getMessage: jest.fn(() => mockMessage),
  } as unknown as RmqContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiServiceController],
      providers: [AiServiceService],
    }).compile();

    controller = module.get<AiServiceController>(AiServiceController);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Clear mock calls
    mockChannel.ack.mockClear();
    mockChannel.nack.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleTestEvent', () => {
    it('should process test event, acknowledge message and return success response', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const testData = {
        message: 'Hello from be-skillforge!',
        timestamp: new Date(),
      };

      const result = controller.handleTestEvent(testData, mockRmqContext);

      expect(result).toEqual({
        success: true,
        message: 'Test event processed successfully',
        data: {
          message: testData.message,
          timestamp: testData.timestamp,
        },
      });
      expect(logSpy).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should handle different message content and acknowledge', () => {
      const testData = {
        message: 'Different message',
        timestamp: new Date('2025-01-01'),
      };

      const result = controller.handleTestEvent(testData, mockRmqContext);

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Different message');
      expect(result.data.timestamp).toEqual(new Date('2025-01-01'));
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should nack message on error and rethrow', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const testData = {
        message: 'Test message',
        timestamp: new Date(),
      };

      // Force an error by making the logger throw
      jest.spyOn(Logger.prototype, 'log').mockImplementationOnce(() => {
        throw new Error('Processing failed');
      });

      expect(() =>
        controller.handleTestEvent(testData, mockRmqContext),
      ).toThrow('Processing failed');

      expect(errorSpy).toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });
  });
});
