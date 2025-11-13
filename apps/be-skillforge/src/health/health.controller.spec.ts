import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { RedisService } from '@app/redis';
import { SkillforgePrismaService } from '../../prisma/prisma.service';
import { CommonConfigService } from '@app/common-config';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let microserviceHealthIndicator: MicroserviceHealthIndicator;
  let prismaService: SkillforgePrismaService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: MicroserviceHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
        {
          provide: SkillforgePrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            healthCheck: jest.fn(),
          },
        },
        {
          provide: CommonConfigService,
          useValue: {
            rabbitmq: {
              url: 'amqp://localhost',
            },
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    microserviceHealthIndicator = module.get<MicroserviceHealthIndicator>(
      MicroserviceHealthIndicator,
    );
    prismaService = module.get<SkillforgePrismaService>(
      SkillforgePrismaService,
    );
    redisService = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health check result', async () => {
      const mockResult = {
        status: 'ok' as const,
        info: {},
        error: {},
        details: {},
      };
      const checkSpy = jest
        .spyOn(healthCheckService, 'check')
        .mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result).toEqual(mockResult);
      expect(checkSpy).toHaveBeenCalled();
    });

    it('should check database health', async () => {
      const queryRawSpy = jest
        .spyOn(prismaService, '$queryRaw')
        .mockResolvedValue([{}]);
      jest
        .spyOn(healthCheckService, 'check')
        .mockImplementation(async (checks) => {
          await checks[0]();
          return { status: 'ok' as const, info: {}, error: {}, details: {} };
        });

      await controller.check();

      expect(queryRawSpy).toHaveBeenCalled();
    });

    it('should check redis health', async () => {
      const healthCheckSpy = jest
        .spyOn(redisService, 'healthCheck')
        .mockResolvedValue({ status: 'up' });
      jest
        .spyOn(healthCheckService, 'check')
        .mockImplementation(async (checks) => {
          await checks[1]();
          return { status: 'ok' as const, info: {}, error: {}, details: {} };
        });

      await controller.check();

      expect(healthCheckSpy).toHaveBeenCalled();
    });

    it('should check rabbitmq health', async () => {
      const pingCheckSpy = jest
        .spyOn(microserviceHealthIndicator, 'pingCheck')
        .mockResolvedValue({ rabbitmq: { status: 'up' } });
      jest
        .spyOn(healthCheckService, 'check')
        .mockImplementation(async (checks) => {
          await checks[2]();
          return { status: 'ok' as const, info: {}, error: {}, details: {} };
        });

      await controller.check();

      expect(pingCheckSpy).toHaveBeenCalledWith('rabbitmq', expect.any(Object));
    });

    it('should throw error when database check fails', async () => {
      const error = new Error('Database connection failed');
      jest.spyOn(prismaService, '$queryRaw').mockRejectedValue(error);

      jest
        .spyOn(healthCheckService, 'check')
        .mockImplementation(async (checks) => {
          await expect(checks[0]()).rejects.toThrow(
            'Database health check failed',
          );
          return { status: 'ok' as const, info: {}, error: {}, details: {} };
        });

      await controller.check();
    });

    it('should throw error when redis check fails', async () => {
      jest
        .spyOn(redisService, 'healthCheck')
        .mockResolvedValue({ status: 'down', error: 'Connection refused' });

      jest
        .spyOn(healthCheckService, 'check')
        .mockImplementation(async (checks) => {
          await expect(checks[1]()).rejects.toThrow(
            'Redis health check failed',
          );
          return { status: 'ok' as const, info: {}, error: {}, details: {} };
        });

      await controller.check();
    });
  });

  describe('ready', () => {
    it('should call check method', async () => {
      const mockResult = {
        status: 'ok' as const,
        info: {},
        error: {},
        details: {},
      };
      const checkSpy = jest
        .spyOn(controller, 'check')
        .mockResolvedValue(mockResult);

      const result = await controller.ready();

      expect(result).toEqual(mockResult);
      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe('live', () => {
    it('should return liveness status', () => {
      const result = controller.live();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
