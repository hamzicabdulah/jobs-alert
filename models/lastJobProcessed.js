const mongoose = require('mongoose');

module.exports = mongoose.model('last_processed_jobs', new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    unique: true
  },
  jobId: {
    type: String,
    required: true,
    unique: true
  }
}));