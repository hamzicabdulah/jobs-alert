/** Imports */
const SlackBotAPI = require('slackbots');
require('dotenv').config({});
const request = require('request-promise');
const Guru = require('./platforms/guru.js');
const Freelancer = require('./platforms/freelancer.js');
const {
  getCategories,
  updateLastJobProcessed,
  flipCategorySelection,
  getKeywords
} = require('./database');
const { USDFormat } = require('./utils');

const platformIconUrls = {
  guru: 'https://goo.gl/ewa9YG',
  freelancer: 'https://goo.gl/jwm6ep'
};


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
    this.bot.on('start', async () => {
      console.log('Started Slack Bot.');
      await this.sendNewJobs();
      setInterval(() => this.sendNewJobs(), 300000);
    });
  }

  /**
   * Send new jobs from each website synchronously
   */
  async sendNewJobs() {
    await this.sendNewFreelancerJobs();
    await this.sendNewGuruJobs();
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

      await guru.endNightmare();

      if (newJobs.length) {
        await updateLastJobProcessed('Guru', newJobs[0]);

        console.log('Sending new Guru jobs.');
        newJobs.reverse().forEach(job => this.sendGuruJob(job));
        console.log('Successfully sent new Guru jobs.');
      }
    } catch (err) {
      console.error(`Something went wrong while sending new Guru jobs. Error received: ${err}`);
      await guru.endNightmare();
      return this.sendNewGuruJobs();
    }
  }

  /**
   * Send a formatted message on Slack with the given jobDetails (Guru job)
   * 
   * @param {Object} jobDetails - All the job data
   */
  sendGuruJob(jobDetails) {
    const params = {
      icon_url: platformIconUrls.guru,
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
              value: jobDetails.budget.type === 'Hourly Pay' ?
                `- Type: ${jobDetails.budget.type}\n- Number of Days: ${jobDetails.budget.daysNum}\n` +
                `- Number of Hours: ${jobDetails.budget.hoursNum}\n- Rate: ${jobDetails.budget.rate}` :
                `- Type: ${jobDetails.budget.type}\n- Amount: ${jobDetails.budget.amount}`
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
   * Send a message on Slack with the categories from the given platform/website 
   * that the user has previously selected
   * Allow the user to select/unselect categories via pressing buttons
   * 
   * @param {string} platform - Name of the website whose categories to change
   */
  async sendCategories(platform) {
    console.log(`Sending ${platform} categories.`);

    try {
      const categories = await getCategories(platform);
      const params = this.getCategoriesMessageParams(platform, categories);
      this.bot.postMessageToChannel(process.env.SLACK_CHANNEL_NAME, '', params);
      console.log(`Successfully sent ${platform} categories.`);
    } catch (err) {
      console.error(`Something went wrong while trying to send ${platform} categories. Error received: ${err}`);
      this.sendErrorMessage(platform);
    }
  }

  /**
   * Return formatted Slack message params for the database categories
   * This function is used by sendGuruCategories() and updateGuruCategories()
   * 
   * @param {string} platform - Name of the website whose categories to change
   * @param {Object[]} categories - All Guru categories with name, platform, href and selected properties
   * @returns {Object} - Formatted Slack message params
   */
  getCategoriesMessageParams(platform, categories) {
    return {
      icon_url: platformIconUrls[platform.toLowerCase()],
      username: platform,
      text: 'Click on a category to select/unselect it.',
      attachments: categories.map(category => {
        return {
          title: '',
          color: '#fff',
          callback_id: `${platform.toLowerCase()}_category`,
          actions: [
            {
              name: category.name,
              text: `${category.name} ${category.selected ? '✔' : ''}`,
              type: 'button',
              value: category.href || category.id
            }
          ]
        };
      })
    };
  }

  /**
   * Select/unselect the given category in the database
   * Then edit the message with the given timestamp with the updated categories
   * 
   * @param {string} platform - Name of the website whose categories to change
   * @param {string} channelId - The id of the channel the original message was sent in
   * @param {string} messageTimestamp - The timestamp of the original message
   * @param {string} categoryToUpdate - The category to select/unselect in the database
   */
  async flipCategorySelectionSlack(
    platform,
    channelId,
    messageTimestamp,
    categoryToUpdate
  ) {
    try {
      await flipCategorySelection(platform, categoryToUpdate);
      const categories = await getCategories(platform);

      const params = this.getCategoriesMessageParams(platform, categories);
      this.bot.updateMessage(channelId, messageTimestamp, '', params);
    } catch (err) {
      console.error(err);
      this.sendErrorMessage(platform);
    }
  }

  /**
   * Notify the Slack user(s) that something went wrong
   * 
   * @param {string} platform - Name of the website that things went wrong with
   */
  sendErrorMessage(platform) {
    const params = {
      icon_url: platformIconUrls[platform.toLowerCase()],
      username: platform
    };

    this.bot.postMessageToChannel(
      process.env.SLACK_CHANNEL_NAME,
      'Oops. Sorry, I got confused. That didn\'t work.',
      params
    );
  }


  /**
   * Get data about every new job posted on Freelancer
   * And send a message on Slack for each one of those jobs
   */
  async sendNewFreelancerJobs() {
    const freelancer = new Freelancer();
    try {
      const newJobs = await freelancer.getNewJobs();
      if (newJobs.length) {
        await updateLastJobProcessed('Freelancer', newJobs[0]);

        console.log('Sending new Freelancer jobs.');
        newJobs.reverse().forEach(job => this.sendFreelancerJob(job));
        console.log('Successfully sent new Freelancer jobs.');
      }
    } catch (err) {
      console.error(`Something went wrong while sending new Freelancer jobs. Error received: ${err}`);
      return this.sendNewFreelancerJobs();
    }
  }


  /**
   * Send a formatted message on Slack with the given jobDetails (Freelancer job)
   * 
   * @param {Object} jobDetails - All the job data
   */
  sendFreelancerJob(jobDetails) {
    const freelancerBaseUrl = 'https://www.freelancer.com/projects';
    const params = {
      icon_url: platformIconUrls.freelancer,
      username: 'Freelancer',
      attachments: [
        {
          fallback: jobDetails.title,
          color: '#36a64f',
          title: jobDetails.title.toUpperCase(),
          title_link: `${freelancerBaseUrl}/${jobDetails.seo_url}`,
          fields: [
            {
              title: 'Description',
              value: jobDetails.description
            },
            {
              title: 'Budget',
              value: `- Minimum: ${USDFormat(jobDetails.budget.minimum)}\n` +
                `- Maximum: ${USDFormat(jobDetails.budget.maximum)}\n`
            },
            {
              title: 'Bids Statistics',
              value: `- Bids Count: ${jobDetails.bid_stats.bid_count}` +
                (jobDetails.bid_stats.bid_count ?
                  `\n- Average Bid: ${USDFormat(jobDetails.bid_stats.bid_avg)}` : '')
            }
          ],
          callback_id: 'freelancer_job',
          actions: [
            {
              type: 'button',
              text: 'Open In Browser',
              url: `${freelancerBaseUrl}/${jobDetails.seo_url}`
            }
          ]
        }
      ]
    };

    this.bot.postMessageToChannel(process.env.SLACK_CHANNEL_NAME, '', params);
  }


  /**
   * Open a Slack dialog which shows the previously selected keywords for the given platforms
   * and also lets the user remove any keywords or add new ones
   * 
   * @param {string} platform - Name of the website whose keywords to send
   * @param {string} triggerId - Required for the API request
   */
  async sendKeywords(platform, triggerId) {
    try {
      console.log(`Sending ${platform} keywords.`);
      const selectedKeywords = await getKeywords(platform);
      const requestBody = {
        trigger_id: triggerId,
        dialog: {
          callback_id: `${platform.toLowerCase()}_keywords`,
          title: `${platform} Keywords`,
          submit_label: 'Save',
          state: 'Limo',
          elements: [
            {
              label: 'Selected Keywords',
              name: 'keywords',
              type: 'textarea',
              placeholder: 'you@example.com',
              value: selectedKeywords.map(keyword => keyword.value).join(', '),
              optional: true
            }
          ]
        }
      };
      await this.apiRequest('/dialog.open', requestBody);
      console.log(`Successfully sent ${platform} keywords.`);
    } catch (err) {
      console.error(err);
      this.sendErrorMessage(platform);
    }
  }

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