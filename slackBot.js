/** Imports */
const SlackBotAPI = require('slackbots');
require('dotenv').config({});
const request = require('request-promise');
const Guru = require('./platforms/guru.js');

const guruIconUrl = 'https://goo.gl/ewa9YG';


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
      name: 'jobsalert'
    });

    this.bot.on('error', console.error);
    this.bot.on('start', () => {
      this.sendNewGuruJobs();
      setInterval(() => this.sendNewGuruJobs(), 300000);
    });
  }

  /**
   * Get data about every new job posted on Guru
   * And send a message on Slack for each one of those jobs
   */
  async sendNewGuruJobs() {
    const guru = new Guru();
    try {
      guru.startNightmare();
      await guru.login();
      if (await guru.requiresSecurityAnswer())
        await guru.answerSecurityQuestion();

      const allJobUrls = await guru.getAllJobUrls();
      const newJobs = await guru.getNewJobs(allJobUrls);

      if (newJobs.length)
        await guru.updateLastJobProcessed(newJobs[0]);

      await guru.endNightmare();

      newJobs.reverse().forEach(job => this.sendGuruJob(job));
    } catch (err) {
      console.error(err);
      await guru.endNightmare();
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
      icon_url: guruIconUrl,
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
          callback_id: 'guru_job',
          actions: [
            /* {
              name: 'apply',
              text: 'Apply',
              type: 'button',
              value: jobDetails.url
            }, */
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
  async sendGuruCategories() {
    try {
      const guru = new Guru();
      const categories = await guru.getCategories();
      const params = this.getGuruCategoriesMessageParams(categories);
      this.bot.postMessageToChannel(process.env.SLACK_CHANNEL_NAME, '', params);
    } catch (err) {
      console.error(err);
      this.sendErrorMessage();
    }
  }

  /**
   * Return formatted Slack message params for the database categories
   * This function is used by sendGuruCategories() and updateGuruCategories()
   * 
   * @param {Object[]} categories - All Guru categories with name, platform, href and selected properties
   * @returns {Object} - Formatted Slack message params
   */
  getGuruCategoriesMessageParams(categories) {
    return {
      icon_url: guruIconUrl,
      username: 'Guru',
      text: 'Click on a category to select/unselect it.',
      attachments: categories.map(category => {
        return {
          title: '',
          color: '#fff',
          callback_id: 'guru_category',
          actions: [
            {
              name: category.name,
              text: `${category.name} ${category.selected ? '✔' : ''}`,
              type: 'button',
              value: category.href
            }
          ]
        };
      })
    };
  }

  /**
   * Select/unselect the categoryClicked in the database
   * Then edit the message with the given timestamp with the updated categories
   * 
   * @param {string} channelId - The id of the channel the original message was sent in by sendGuruCategories()
   * @param {string} messageTimestamp - The timestamp of the original message
   * @param {string} categoryToUpdate - The category to select/unselect in the database
   */
  async flipGuruCategorySelection(channelId, messageTimestamp, categoryToUpdate) {
    try {
      const guru = new Guru();
      await guru.flipCategorySelection(categoryToUpdate);
      const categories = await guru.getCategories();

      const params = this.getGuruCategoriesMessageParams(categories);
      this.bot.updateMessage(channelId, messageTimestamp, '', params);
    } catch (err) {
      console.error(err);
      this.sendErrorMessage();
    }
  }

  /**
   * Notify the Slack user(s) that something went wrong
   */
  sendErrorMessage() {
    const params = {
      icon_url: guruIconUrl,
      username: 'Guru'
    };

    this.bot.postMessageToChannel(
      process.env.SLACK_CHANNEL_NAME,
      'Oops. Sorry, I got confused. That didn\'t work.',
      params
    );
  }

  /**
   * Interact with the user and apply to a Guru job
   * 
   * @param {string} jobUrl - The URL of the job to apply to
   * @param {string} triggerId - Required for the API request
   */
  /* guruApply(jobUrl, triggerId) {
    const requestBody = {
      trigger_id: triggerId,
      dialog: {
        callback_id: 'guru_apply',
        title: 'Apply',
        submit_label: 'Apply',
        notify_on_cancel: true,
        state: 'Limo',
        elements: [
          {
            label: 'Billing based on',
            type: 'select',
            name: 'billing',
            options: [
              {
                label: 'Hourly by Time Tracked',
                value: 'QUOTES.SUBMIT.lblHourly'
              },
              {
                label: 'Fixed Price by Milestone',
                value: 'QUOTES.SUBMIT.lblFixedPrice'
              }
            ]
          }
        ]
      }
    };

    this.apiRequest('/dialog.open', requestBody)
      .catch(console.error);
  } */

  /**
   * 
   * @param {string} route - The Slack API route to send a request to (e.g. '/dialog.open')
   * @param {Object} requestBody - The request body to send with the HTTP request
   * @returns {Object} - The response received from Slack's API
   */
  apiRequest(route, requestBody) {
    const options = {
      method: 'POST',
      uri: `https://slack.com/api${route}`,
      body: requestBody,
      json: true,
      headers: {
        'Content-type': 'application/json',
        Authorization: `Bearer ${process.env.SLACK_TOKEN}`
      }
    };

    return request(options);
  }
}