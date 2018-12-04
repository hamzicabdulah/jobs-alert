/** Imports */
const SlackBot = require('slackbots');
require('dotenv').config({});
const Guru = require('./platforms/guru.js');

/** Slack bot */
const bot = new SlackBot({
  token: process.env.BOT_TOKEN,
  name: 'jobsalert'
});

bot.on('message', message => {
  if (message.text && message.text.includes('jobsalert guru categories'))
    sendGuruCategories();
});
bot.on('error', console.error);
bot.on('start', () => {
  sendNewGuruJobs();
  setInterval(sendNewGuruJobs, 300000);
});

/**
 * Get data about every new job posted on Guru
 * And send a message on Slack for each one of those jobs
 */
async function sendNewGuruJobs() {
  try {
    const guru = new Guru();
    guru.startNightmare();
    await guru.login();
    if (await guru.requiresSecurityAnswer())
      await guru.answerSecurityQuestion();

    const allJobUrls = await guru.getAllJobUrls();
    const newJobs = await guru.getNewJobs(allJobUrls);

    if (newJobs.length)
      guru.updateLastJobSent(newJobs[0]);

    await guru.endNightmare();

    newJobs.reverse().forEach(job => sendGuruJob(job));
  } catch (err) {
    console.error(err);
    await guru.closeNightmare();
    return sendNewGuruJobs();
  }
}

/**
 * Send a formatted message on Slack with the given jobDetails
 * 
 * @param {Object} jobDetails - All the job data
 */
function sendGuruJob(jobDetails) {
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

/**
 * Send a message on Slack with the categories the user has previously selected
 * Allow the user to select/unselect categories via pressing buttons
 */
function sendGuruCategories() {
  const guru = new Guru();
  const allCategories = guru.getAllCategories();
  const selectedCategories = guru.getSelectedCategories();

  const params = {
    icon_url: 'https://goo.gl/ewa9YG',
    username: 'Guru',
    attachments: [
      {
        fallback: 'Categories',
        color: '#36a64f',
        title: 'Categories',
        text: 'To select a category/categories, run `jobsalert guru categories select [category_name(s)]`. ' +
          'To unselect a category/categories, run \`jobsalert guru categories unselect [category_name(s)]`. ' +
          'If selecting/unselecting multiple categories, separate them by commas.'
      },
      {
        fallback: 'Categories',
        color: '#36a64f',
        fields: [
          {
            title: 'Selected',
            value: selectedCategories.map(selectedCategory => {
              return `- ${allCategories.find(category => category.href === selectedCategory).name}`;
            }).join('\n')
          },
          {
            title: 'Not Selected',
            value: allCategories.filter(category => !selectedCategories.includes(category.href))
              .map(category => `- ${category.name}`).join('\n')
          }
        ]
      }
    ]
  };

  bot.postMessageToChannel('jobs-alert', '', params);
}