// Generic "cache-aside" helper.
// Pattern: check Redis first -> if miss, run the real DB query -> store result -> return it.
// This is the standard approach interviewers/reviewers expect to see explained.

const redisClient = require('./redisClient');

/**
 * Get data from cache, or compute it and cache it if missing.
 * @param {string} key - unique cache key, e.g. 'analytics:revenue:daily'
 * @param {number} ttlSeconds - how long to keep the cached value (e.g. 60 = 1 min)
 * @param {Function} fetchFunction - async function that returns fresh data on a cache miss
 */
async function getOrSetCache(key, ttlSeconds, fetchFunction) {
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      console.log(`Cache HIT: ${key}`);
      return JSON.parse(cached);
    }
  } catch (err) {
    // If Redis itself fails, don't crash the dashboard — just skip caching this time.
    console.error(`Redis read error for ${key}:`, err.message);
  }

  console.log(`Cache MISS: ${key} — running DB query`);
  const freshData = await fetchFunction();

  try {
    await redisClient.set(key, JSON.stringify(freshData), { EX: ttlSeconds });
  } catch (err) {
    console.error(`Redis write error for ${key}:`, err.message);
  }

  return freshData;
}

module.exports = { getOrSetCache };
