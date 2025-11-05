import * as Joi from 'joi';

// 1. Export the schema as a constant
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  AI_SERVICE_PORT: Joi.number().default(3001),

  // RabbitMQ
  MQ_USER: Joi.string().required(),
  MQ_PASS: Joi.string().required(),
  MQ_HOST: Joi.string().required(),
  MQ_PORT: Joi.number().required(),
  MQ_QUEUE_DURABLE: Joi.boolean().default(true),
  AI_SERVICE_QUEUE: Joi.string().default('ai_service_queue'),

  // Database
  DATABASE_URL_SKILLFORGE: Joi.string().uri().required(),
  DATABASE_URL_AI: Joi.string().uri().required(),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_TLS: Joi.boolean().default(false),
});
