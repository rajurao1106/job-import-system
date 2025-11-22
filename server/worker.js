// server/worker.js
require('dotenv').config();
const mongoose = require('mongoose');
const { startWorker } = require('./workers/importWorker');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Worker connected to MongoDB');
    startWorker();
  }).catch(err => {
    console.error('Worker Mongo connection error', err);
    process.exit(1);
  });
