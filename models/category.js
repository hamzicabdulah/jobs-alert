const mongoose = require('mongoose');

module.exports = mongoose.model('categories', new mongoose.Schema({
  platform: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  href: {
    type: String,
    required: true
  },
  selected: {
    type: Boolean,
    required: true,
    default: false
  }
}));