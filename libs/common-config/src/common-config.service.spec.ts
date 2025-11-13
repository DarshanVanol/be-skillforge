import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService } from './common-config.service';

describe('CommonConfigService', () => {
  let service: CommonConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommonConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CommonConfigService>(CommonConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('env', () => {
    it('should return NODE_ENV', () => {
      mockConfigService.get.mockReturnValue('development');
      expect(service.env).toBe('development');
      expect(mockConfigService.get).toHaveBeenCalledWith('NODE_ENV');
    });
  });

  describe('port', () => {
    it('should return PORT', () => {
      mockConfigService.get.mockReturnValue(3000);
      expect(service.port).toBe(3000);
      expect(mockConfigService.get).toHaveBeenCalledWith('PORT');
    });
  });

  describe('aiServicePort', () => {
    it('should return AI_SERVICE_PORT', () => {
      mockConfigService.get.mockReturnValue(3001);
      expect(service.aiServicePort).toBe(3001);
      expect(mockConfigService.get).toHaveBeenCalledWith('AI_SERVICE_PORT');
    });
  });

  describe('rabbitmq', () => {
    it('should return rabbitmq config', () => {
      mockConfigService.get
        .mockReturnValueOnce('testuser')
        .mockReturnValueOnce('testpass')
        .mockReturnValueOnce('localhost')
        .mockReturnValueOnce(5672)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce('test_queue');

      const config = service.rabbitmq;

      expect(config.user).toBe('testuser');
      expect(config.pass).toBe('testpass');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5672);
      expect(config.isDurableQueue).toBe(true);
      expect(config.aiServiceQueue).toBe('test_queue');
    });

    it('should generate correct url', () => {
      mockConfigService.get
        .mockReturnValueOnce('testuser')
        .mockReturnValueOnce('testpass')
        .mockReturnValueOnce('localhost')
        .mockReturnValueOnce(5672)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce('test_queue');

      const config = service.rabbitmq;
      expect(config.url).toBe('amqps://testuser:testpass@localhost:5672');
    });

    it('should default isDurableQueue to env === production when not set', () => {
      mockConfigService.get
        .mockReturnValueOnce('testuser') // MQ_USER
        .mockReturnValueOnce('testpass') // MQ_PASS
        .mockReturnValueOnce('localhost') // MQ_HOST
        .mockReturnValueOnce(5672) // MQ_PORT
        .mockReturnValueOnce(undefined) // MQ_QUEUE_DURABLE
        .mockReturnValueOnce('production') // NODE_ENV (for this.env)
        .mockReturnValueOnce('test_queue'); // MQ_AI_SERVICE_QUEUE

      const config = service.rabbitmq;
      expect(config.isDurableQueue).toBe(true);
    });
  });

  describe('redis', () => {
    it('should return redis config', () => {
      mockConfigService.get
        .mockReturnValueOnce('redis-host')
        .mockReturnValueOnce(6379)
        .mockReturnValueOnce('redis-password')
        .mockReturnValueOnce(true);

      const config = service.redis;

      expect(config.host).toBe('redis-host');
      expect(config.port).toBe(6379);
      expect(config.password).toBe('redis-password');
      expect(config.tls).toBe(true);
    });

    it('should generate correct url with password and tls', () => {
      mockConfigService.get
        .mockReturnValueOnce('redis-host')
        .mockReturnValueOnce(6379)
        .mockReturnValueOnce('redis-password')
        .mockReturnValueOnce(true);

      const config = service.redis;
      expect(config.url).toBe(
        'redis://:redis-password@redis-host:6379?tls=true',
      );
    });

    it('should generate correct url without password', () => {
      mockConfigService.get
        .mockReturnValueOnce('redis-host')
        .mockReturnValueOnce(6379)
        .mockReturnValueOnce('')
        .mockReturnValueOnce(false);

      const config = service.redis;
      expect(config.url).toBe('redis://redis-host:6379');
    });

    it('should generate correct url without tls', () => {
      mockConfigService.get
        .mockReturnValueOnce('redis-host')
        .mockReturnValueOnce(6379)
        .mockReturnValueOnce('redis-password')
        .mockReturnValueOnce(false);

      const config = service.redis;
      expect(config.url).toBe('redis://:redis-password@redis-host:6379');
    });
  });
});
