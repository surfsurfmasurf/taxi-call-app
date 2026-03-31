const { createClient } = require('redis');

let redisClient;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    redisClient.on('error', (err) => console.error('Redis Error:', err));
    redisClient.on('connect', () => console.log('Redis connected'));

    await redisClient.connect();
  }
  return redisClient;
}

module.exports = { getRedisClient };
