/** Imports */
const SlackBotAPI = require('slackbots');
require('dotenv').config({});
const Guru = require('./platforms/guru.js');


/** jobsalert Slack bot */
module.exports = class SlackBot {
  /**
   * Initiate Slack chat bot
   */
  constructor() {
    this.startSlackBot();
  }

  /**
 * Initiate Slack chat bot
 */
  startSlackBot() {
    this.bot = new SlackBotAPI({
      token: process.env.SLACK_TOKEN,
      name: 'jobs-alert'
    });

    this.bot.on('error', console.error);
    this.bot.on('start', () => {
      this.sendNewGuruJobs();
      setInterval(this.sendNewGuruJobs, 300000);
    });
  }

  /**
   * Get data about every new job posted on Guru
   * And send a message on Slack for each one of those jobs
   */
  async sendNewGuruJobs() {
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

      newJobs.reverse().forEach(job => this.sendGuruJob(job));
    } catch (err) {
      console.error(err);
      await guru.closeNightmare();
      return this.sendNewGuruJobs();
    }
  }

  /**
   * Send a formatted message on Slack with the given jobDetails
   * 
   * @param {Object} jobDetails - All the job data
   */
  sendGuruJob(jobDetails) {
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

    this.bot.postMessageToChannel(process.env.SLACK_CHANNEL_NAME, '', params);
  }

  /**
   * Send a message on Slack with the categories the user has previously selected
   * Allow the user to select/unselect categories via pressing buttons
   */
  sendGuruCategories() {
    const guru = new Guru();
    const allCategories = guru.getAllCategories();
    const selectedCategories = guru.getSelectedCategories();
    const params = this.getGuruCategoriesMessageParams(allCategories, selectedCategories);
    this.bot.postMessageToChannel(process.env.SLACK_CHANNEL_NAME, '', params);
  }

  /**
   * Return formatted Slack message params for the database.json categories
   * This function is used by sendGuruCategories() and updateGuruCategories()
   * 
   * @param {Object[]} - All Guru categories with name and href properties
   * @param {string[]} - Selected Guru categories (href strings only)
   * @returns {Object} - Formatted Slack message params
   */
  getGuruCategoriesMessageParams(allCategories, selectedCategories) {
    return {
      icon_url: 'https://goo.gl/ewa9YG',
      username: 'Guru',
      text: 'Click on a category to select/unselect it.',
      attachments: allCategories.map(category => {
        return {
          title: '',
          color: '#fff',
          callback_id: 'category',
          actions: [
            {
              name: category.name,
              text: `${category.name} ${selectedCategories.includes(category.href) ? '✔' : ''}`,
              type: 'button',
              value: category.href
            }
          ]
        };
      })
    };
  }

  /**
   * Select/unselect the categoryClicked in database.json
   * Then edit the message with the given timestamp with the updated categories
   * 
   * @param {string} channelId - The id of the channel the original message was sent in by sendGuruCategories()
   * @param {string} messageTimestamp - The timestamp of the original message
   * @param {string} categoryToUpdate - The category to select/unselect in database.json
   */
  updateGuruCategories(channelId, messageTimestamp, categoryToUpdate) {
    const guru = new Guru();
    const allCategories = guru.getAllCategories();
    const selectedCategories = guru.getSelectedCategories();

    const updatedCategories = selectedCategories.includes(categoryToUpdate) ?
      selectedCategories.filter(category => category !== categoryToUpdate) :
      [...selectedCategories, categoryToUpdate];

    guru.selectCategories(updatedCategories);

    const params = this.getGuruCategoriesMessageParams(allCategories, updatedCategories);
    this.bot.updateMessage(channelId, messageTimestamp, '', params);
  }
}