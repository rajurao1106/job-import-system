// server/models/Job.js
const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  externalId: { type: String, index: true },
  sourceFeed: { type: String, index: true },
  title: String,
  company: String,
  description: String,
  location: String,
  raw: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('Job', JobSchema);
