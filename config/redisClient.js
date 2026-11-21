// Redis client setup for caching analytics results and the admin logout blacklist.
// Works with a local Redis/Memurai (redis://...) and with a secure online
// service such as Aiven Valkey (rediss://...).

const { createClient } = require('redis');

const url = process.env.REDIS_URL || 'redis://localhost:6379';

const options = { url };

// Secure (TLS) connection for online services
if (url.startsWith('rediss://')) {
  options.socket = { tls: true, rejectUnauthorized: false };
}

const redisClient = createClient(options);

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
