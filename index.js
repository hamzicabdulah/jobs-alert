/** Imports */
const express = require('express');
const SlackBot = require('./slackBot');
const mongooseStart = require('./config/mongooseStart');
const routes = require('./routes');

const app = express();
const slackBot = new SlackBot();

routes(app, slackBot);

const port = process.env.PORT || 3000;
app.listen(port, async err => {
  if (err) throw err;
  console.log(`Listening on port ${port}`);
  await mongooseStart();
});