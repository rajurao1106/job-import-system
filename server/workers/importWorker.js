// server/workers/importWorker.js
require('dotenv').config();
const Queue = require('bull');
const mongoose = require('mongoose');
const Job = require('../models/Job');
const ImportLog = require('../models/ImportLog');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const importQueue = new Queue('importQueue', REDIS_URL);

async function ensureMongoConnection() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
}

/**
 * Normalize raw item to a predictable shape
 */
function normalizeItem(raw, feedUrl) {
  // RSS often uses title, description, guid, link, dc:creator
  const externalId = raw.guid?._ || raw.guid || raw.id || raw.link || (raw['job_id'] && String(raw['job_id'])) || null;
  const title = raw.title || (raw['job_title']) || '';
  const company = raw['dc:creator'] || raw.company || '';
  const description = raw.description || raw.summary || raw.content || '';
  const location = raw.location || raw['job_location'] || '';

  return { externalId, title, company, description, location, sourceFeed: feedUrl, raw };
}

function startWorker() {
  const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10);
  console.log(`Import worker starting (concurrency=${concurrency})`);

  importQueue.process(concurrency, async (job) => {
    const { item, _runId, feedUrl } = job.data;
    await ensureMongoConnection();

    const normalized = normalizeItem(item, feedUrl);

    if (!normalized.externalId) {
      await ImportLog.findByIdAndUpdate(_runId, {
        $push: { failures: { reason: 'missing_external_id', item } },
        $inc: { failedJobs: 1 }
      });
      return Promise.resolve();
    }

    try {
      const existing = await Job.findOne({ externalId: normalized.externalId, sourceFeed: feedUrl });

      if (existing) {
        await Job.updateOne({ _id: existing._id }, {
          $set: {
            title: normalized.title,
            company: normalized.company,
            description: normalized.description,
            location: normalized.location,
            raw: normalized.raw
          }
        });

        await ImportLog.findByIdAndUpdate(_runId, { $inc: { updatedJobs: 1, totalImported: 1 } });
      } else {
        await Job.create(normalized);
        await ImportLog.findByIdAndUpdate(_runId, { $inc: { newJobs: 1, totalImported: 1 } });
      }
    } catch (err) {
      await ImportLog.findByIdAndUpdate(_runId, {
        $push: { failures: { reason: err.message, item } },
        $inc: { failedJobs: 1 }
      });
      throw err;
    }
  });

  importQueue.on('failed', (job, err) => {
    console.error('Job failed in queue', job.id, err.message);
  });

  importQueue.on('error', err => {
    console.error('Queue error', err); 
  });
}

module.exports = { startWorker }; 
