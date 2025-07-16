// server/config/config.js
module.exports = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/justconnect',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
