const Redis = require('ioredis');
const logger = require('./logger');

let redisClient;

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

async function connectRedis() {
  redisClient = new Redis(REDIS_CONFIG);

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err.message);
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis client reconnecting...');
  });

  await redisClient.connect().catch(() => {
    // Already handled by lazyConnect
  });

  return redisClient;
}

function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

module.exports = { connectRedis, getRedisClient };
