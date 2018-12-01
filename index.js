/** Imports */
const SlackBot = require('slackbots');
require('dotenv').config({});
const Guru = require('./platforms/guru.js');

/** Slack bot */
const bot = new SlackBot({
  token: process.env.BOT_TOKEN,
  name: 'jobs-alert'
});

bot.on('error', console.error)

bot.on('start', () => {
  setInterval(sendNewJobs, 70000);
});

/**
 * Get data about every new job posted on Guru
 * And send a message on Slack for each one of those jobs
 */
async function sendNewJobs() {
  try {
    const guru = new Guru();

    await guru.login();
    if (await guru.requiresSecurityAnswer())
      await guru.answerSecurityQuestion();

    const last20JobUrls = await guru.getLast20JobUrls();
    const newJobs = await guru.getNewJobs(last20JobUrls);

    if (newJobs.length)
      guru.updateLastJobSent(newJobs[0]);

    await guru.closeNightmare();

    newJobs.reverse().forEach(job => sendJob(job));
  } catch (err) {
    console.error(err);
    return sendNewJobs();
  }
}

/**
 * Send a formatted message on Slack with the given jobDetails
 * 
 * @param {Object} jobDetails - All the job data
 */
function sendJob(jobDetails) {
  const params = {
    icon_url: 'https://goo.gl/ewa9YG',
    username: 'Guru',
    attachments: [
      {
        fallback: jobDetails.title,
        color: '#36a64f',
        title: jobDetails.title.toUpperCase(),
        title_link: jobDetails.url,
        fields: [
          {
            title: 'Description',
            value: jobDetails.description
          },
          {
            title: 'Budget',
            value: `- Type: ${jobDetails.budget.type}\n- Amount: ${jobDetails.budget.amount}`
          },
          {
            title: 'Employer',
            value: `- Name: ${jobDetails.employer.name}\n- Country: ${jobDetails.employer.country}\n` +
              `- Feedback: ${jobDetails.employer.feedback}\n- Paid: ${jobDetails.employer.paid}\n` +
              `- Paid Jobs: ${jobDetails.employer.paidJobs}`
          }
        ],
        actions: [
          {
            name: 'apply',
            text: 'Apply',
            type: 'button',
            value: 'apply'
          },
          {
            type: 'button',
            text: 'Open In Browser',
            url: jobDetails.url
          }
        ]
      }
    ]
  };

  bot.postMessageToChannel('jobs-alert', '', params);
}