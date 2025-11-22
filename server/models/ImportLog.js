// server/models/ImportLog.js
const mongoose = require('mongoose');

const FailureSchema = new mongoose.Schema({
  reason: String,
  item: mongoose.Schema.Types.Mixed,
  at: { type: Date, default: Date.now }
}, { _id: false });

const ImportLogSchema = new mongoose.Schema({
  fileName: String,
  timestamp: { type: Date, default: Date.now },
  meta: {
    planned: { type: Number, default: 0 }
  },
  totalFetched: { type: Number, default: 0 },
  totalImported: { type: Number, default: 0 },
  newJobs: { type: Number, default: 0 },
  updatedJobs: { type: Number, default: 0 },
  failedJobs: { type: Number, default: 0 },
  failures: [FailureSchema]
});

module.exports = mongoose.model('ImportLog', ImportLogSchema);
