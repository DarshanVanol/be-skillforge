import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { of, throwError } from 'rxjs';
import { Logger } from '@nestjs/common';

describe('AppController', () => {
  let controller: AppController;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const mockClientProxy = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: 'AI_SERVICE',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('testMessageQueue', () => {
    it('should successfully send message and receive response', async () => {
      const mockResponse = {
        success: true,
        message: 'Test event processed successfully',
        data: {
          message: 'Hello from be-skillforge!',
          timestamp: new Date() as unknown,
        },
      };

      mockClientProxy.send.mockReturnValue(of(mockResponse));

      const result = await controller.testMessageQueue();

      expect(result).toEqual({
        status: 'OK',
        responseFromAiService: mockResponse,
      });
      expect(mockClientProxy.send).toHaveBeenCalledWith(
        'test_event',
        expect.objectContaining({
          message: 'Hello from be-skillforge!',
        }) as unknown,
      );
      expect(logSpy).toHaveBeenCalled();
    });

    it('should handle error when AI service fails', async () => {
      const errorMessage = 'Connection failed';
      mockClientProxy.send.mockReturnValue(
        throwError(() => new Error(errorMessage)),
      );

      const result = await controller.testMessageQueue();

      expect(result).toEqual({
        status: 'ERROR',
        message: errorMessage,
      });
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
