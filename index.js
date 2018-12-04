/** Imports */
const express = require('express');
const bodyParser = require('body-parser');
const SlackBot = require('./slackBot');

const app = express();
const slackBot = new SlackBot();
const urlencodedParser = bodyParser.urlencoded({ extended: false })


const guruRouter = express.Router();

guruRouter.post('/categories', urlencodedParser, (req, res) => {
  if (req.body.token !== process.env.SLACK_VERIFICATION_TOKEN)
    return res.status(403).end('Access forbidden');

  res.status(200).end();
  slackBot.sendGuruCategories();
});

app.use('/guru', guruRouter);

app.post('/action', urlencodedParser, (req, res) => {
  const payload = JSON.parse(req.body.payload);
  if (payload.token !== process.env.SLACK_VERIFICATION_TOKEN)
    return res.status(403).end('Access forbidden');
  res.status(200).end();

  switch (payload.callback_id) {
    case 'guru_category':
      slackBot.updateGuruCategories(
        payload.channel.id,
        payload.original_message.ts,
        payload.actions[0].value
      );
      break;

    case 'guru_job':
      if (payload.actions[0].name === 'apply')
        slackBot.guruApply(payload.actions[0].value);
      break;
  };
});

const port = process.env.PORT || 3000;
app.listen(port, err => {
  if (err) throw err;
  console.log(`Listening on port ${port}`);
});