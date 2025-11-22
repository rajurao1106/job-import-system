// server/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { fetchAndEnqueue } = require('./services/fetcher');
const { startWorker } = require('./workers/importWorker');
const Job = require('./models/Job');
const ImportLog = require('./models/ImportLog');

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000", credentials: true }));

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error('Mongo connection error', err));

// Health
app.get('/health', (_, res) => res.json({ ok: true }));

// Jobs list
app.get('/api/jobs', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    const total = await Job.countDocuments(filter);
    const rows = await Job.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit);
    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single job
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import logs
app.get('/api/import-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const logs = await ImportLog.find().sort({ timestamp: -1 }).skip(skip).limit(limit);
    const total = await ImportLog.countDocuments();
    res.json({ data: logs, meta: { total, page, limit } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single import log
app.get('/api/import-logs/:id', async (req, res) => {
  try {
    const log = await ImportLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: 'ImportLog not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger reimport
app.post('/api/reimport', async (req, res) => {
  try {
    const { feedUrl } = req.body;
    if (!feedUrl) return res.status(400).json({ error: 'feedUrl required' });
    const importLog = await fetchAndEnqueue(feedUrl);
    res.json({ ok: true, importLogId: importLog._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reprocess a job
app.post('/api/jobs/:id/reprocess', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const Queue = require('bull');
    const importQueue = new Queue('importQueue', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

    const importLog = await ImportLog.create({ fileName: `reprocess:${job._id}`, meta: { reprocessJobId: job._id } });

    await importQueue.add({
      item: job.raw || job.toObject(),
      _runId: importLog._id,
      feedUrl: job.sourceFeed || 'manual'
    });

    res.json({ ok: true, importLogId: importLog._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// start server
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  // start in-process worker for dev convenience
  startWorker();

  // hourly cron using FEED_URLS env var (comma separated)
  const feeds = (process.env.FEED_URLS || '').split(',').filter(Boolean);
  if (feeds.length) {
    const HOUR = 1000 * 60 * 60;
    setInterval(async () => {
      for (const f of feeds) {
        try {
          await fetchAndEnqueue(f);
        } catch (err) {
          console.error('feed fetch error', f, err.message);
        }
      }
    }, HOUR);

    // run once immediately
    (async () => {
      for (const f of feeds) {
        try {
          await fetchAndEnqueue(f);
        } catch (err) {
          console.error('feed fetch error', f, err.message);
        } 
      } 
    })();
  } 
});
