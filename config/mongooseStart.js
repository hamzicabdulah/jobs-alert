const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

mongoose.Promise = global.Promise;

module.exports = async function () {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });
    console.log('Mongo database running');
  } catch (e) {
    console.log(`Mongo error: ${e}`);
  }
};