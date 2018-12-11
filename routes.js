const express = require('express');
const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false })
const categoriesRouter = express.Router();
const { capitalize } = require('./utils');

module.exports = function (app, slackBot) {
  app.post('/categories/:platform', urlencodedParser, (req, res) => {
    if (req.body.token !== process.env.SLACK_VERIFICATION_TOKEN)
      return res.status(403).end('Access forbidden');

    res.status(200).end();
    slackBot.sendCategories(capitalize(req.params.platform));
  });

  app.post('/action', urlencodedParser, (req, res) => {
    const payload = JSON.parse(req.body.payload);
    if (payload.token !== process.env.SLACK_VERIFICATION_TOKEN)
      return res.status(403).end('Access forbidden');
    res.status(200).end();

    const platform = capitalize(payload.callback_id).split('_')[0];

    slackBot.flipCategorySelectionSlack(
      platform,
      payload.channel.id,
      payload.original_message.ts,
      payload.actions[0].value
    );
  });
}