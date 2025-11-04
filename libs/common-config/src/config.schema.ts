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
});
