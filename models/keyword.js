const mongoose = require('mongoose');

module.exports = mongoose.model('keywords', new mongoose.Schema({
  platform: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true,
    default: ''
  }
}));