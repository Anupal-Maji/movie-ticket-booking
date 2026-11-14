// Redis client setup for caching analytics query results.
// npm install redis
//
// Make sure Redis server is running locally, or point REDIS_URL
// to a hosted Redis instance (e.g. Redis Cloud free tier) in your .env

const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Connect immediately when this module is required
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err.message);
  }
})();

module.exports = redisClient;
