import { Test, TestingModule } from '@nestjs/testing';
import { RedisHealthController } from './redis.health.controller';
import { RedisService } from './redis.service';

describe('RedisHealthController', () => {
  let controller: RedisHealthController;

  const mockRedisService = {
    healthCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RedisHealthController],
      providers: [
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    controller = module.get<RedisHealthController>(RedisHealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health check result from redis service', async () => {
      const healthResult = { status: 'up' };
      mockRedisService.healthCheck.mockResolvedValue(healthResult);

      const result = await controller.check();

      expect(result).toEqual(healthResult);
      expect(mockRedisService.healthCheck).toHaveBeenCalled();
    });
  });
});
