const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false })
const { capitalize } = require('./utils');
const { updateKeywords } = require('./database');

module.exports = function (app, slackBot) {
  app.post('/categories/:platform', urlencodedParser, (req, res) => {
    if (req.body.token !== process.env.SLACK_VERIFICATION_TOKEN)
      return res.status(403).end('Access forbidden');

    res.status(200).end();
    slackBot.sendCategories(capitalize(req.params.platform));
  });

  app.post('/keywords/:platform', urlencodedParser, (req, res) => {
    if (req.body.token !== process.env.SLACK_VERIFICATION_TOKEN)
      return res.status(403).end('Access forbidden');

    res.status(200).end();
    slackBot.sendKeywords(capitalize(req.params.platform), req.body.trigger_id);
  });

  app.post('/action', urlencodedParser, (req, res) => {
    const payload = JSON.parse(req.body.payload);
    if (payload.token !== process.env.SLACK_VERIFICATION_TOKEN)
      return res.status(403).end('Access forbidden');

    res.status(200).end();
    const platform = capitalize(payload.callback_id).split('_')[0];

    if (payload.callback_id.includes('category')) {
      slackBot.flipCategorySelectionSlack(
        platform,
        payload.channel.id,
        payload.original_message.ts,
        payload.actions[0].value
      );
    } else if (payload.callback_id.includes('keywords')) {
      try {
        updateKeywords(platform, payload.submission.keywords);
      } catch (err) {
        console.error(err);
        slackBot.sendErrorMessage(platform);
      }
    }
  });
}