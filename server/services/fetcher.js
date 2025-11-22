// server/services/fetcher.js
const axios = require('axios');
const xml2js = require('xml2js');
const ImportLog = require('../models/ImportLog');
const Queue = require('bull');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const importQueue = new Queue('importQueue', REDIS_URL);

async function fetchFeedItems(feedUrl) {
  const res = await axios.get(feedUrl, { timeout: 20000, responseType: 'text' });
  const body = res.data;

  const isXml = typeof body === 'string' && body.trim().startsWith('<');

  if (isXml) {
    const parsed = await xml2js.parseStringPromise(body, { explicitArray: false, mergeAttrs: true, trim: true });
    // Common patterns:
    // rss.channel.item  OR feed.entry
    const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
    return Array.isArray(items) ? items : (items ? [items] : []);
  }

  // JSON fallback
  if (Array.isArray(body)) return body;
  if (typeof body === 'object') return body.items || body.results || [body];
  return [];
}

/**
 * Create ImportLog and enqueue each item for worker to process
 */
async function fetchAndEnqueue(feedUrl) {
  const log = await ImportLog.create({
    fileName: feedUrl,
    timestamp: new Date(),
    meta: { planned: 0 }
  });

  let items = [];
  try {
    items = await fetchFeedItems(feedUrl);
  } catch (err) {
    await ImportLog.findByIdAndUpdate(log._id, {
      $push: { failures: { reason: 'fetch_error:' + err.message, item: null } },
      $inc: { failedJobs: 1 }
    });
    return log;
  }

  const planned = items.length;
  await ImportLog.findByIdAndUpdate(log._id, { $set: { meta: { planned }, totalFetched: planned } });

  // enqueue items
  for (const item of items) {
    await importQueue.add({ item, _runId: log._id, feedUrl }, { attempts: 2, backoff: { type: 'exponential', delay: 1000 } });
  }

  return log;
}

module.exports = { fetchFeedItems, fetchAndEnqueue };
