// server/queues/jobQueue.js
const Bull = require('bull');
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new Redis(redisUrl);

const jobQueue = new Bull('job-import-queue', { redis: connection });

module.exports = jobQueue;
