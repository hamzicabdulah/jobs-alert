/** Imports */
const path = require('path');
const Nightmare = require('nightmare');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});
const { getCategories, getLastJobProcessed } = require('../database');

/** Constants */
const platform = 'Guru';
const guruBaseUrl = 'https://www.guru.com';

/** Class containing any code related to Guru */
module.exports = class Guru {
  /**
   * Create a new instance of Nightmare
   */
  startNightmare() {
    this.nightmare = Nightmare({ show: false })
    console.log('Started Nightmare.');
  }

  /**
   * Log in to Guru 
   */
  login() {
    console.log('Logging in to Guru.');

    const usernameInput = 'input#ctl00_ContentPlaceHolder1_ucLogin_txtUserName_txtUserName_TextBox';
    const passwordInput = 'input#ctl00_ContentPlaceHolder1_ucLogin_txtPassword_txtPassword_TextBox';
    const signInButton = 'input#ctl00_ContentPlaceHolder1_btnLoginAccount_btnLoginAccount_Button';

    return this.nightmare.goto(`${guruBaseUrl}/login.aspx`)
      .wait('body')
      .insert(usernameInput, process.env.GURU_USERNAME)
      .insert(passwordInput, process.env.GURU_PASSWORD)
      .click(signInButton)
      .then(() => console.log('Successfully logged in to Guru.'));
  }

  /**
   * Return true if the page Nightmare is the one 
   * that asks a security question, and false otherwise
   * 
   * @param {Boolean}
   */
  requiresSecurityAnswer() {
    return this.nightmare.wait(2500)
      .wait('body')
      .evaluate(() => location.href.includes('SecurityQuestions'));
  }

  /**
   * Try every security answer until correct
   */
  async answerSecurityQuestion() {
    console.log('Answering Guru security question.');

    const possibleSecurityAnswers = process.env.GURU_SECURITY_ANSWERS.split(',');

    for (let i = 0; i < possibleSecurityAnswers.length; i++) {
      await this.trySecurityAnswer(possibleSecurityAnswers[i]);
      if (!await this.requiresSecurityAnswer())
        return console.log('Successfully answered Guru security question.');
    }
  }

  /**
   * Try answering the given security question with this securityAnswer
   * 
   * @param {string} securityAnswer - Possible answer to the given security question
   */
  trySecurityAnswer(securityAnswer) {
    const securityAnswerInput = 'input#ctl00_ContentPlaceHolder1_ucSqAnswer_txtAns1_txtAns1_TextBox';
    const continueButton = 'input#ctl00_ContentPlaceHolder1_ucSqAnswer_btnSave_btnSave_Button';

    return this.nightmare.insert(securityAnswerInput, securityAnswer)
      .click(continueButton);
  }

  /**
   * Get the URLs of all the jobs on Guru's first page
   * that are relevant to the user, i.e. belong to the 
   * categories that the user has previously selected
   * 
   * @returns {string[]} - Array of the URLs of the last relevant Guru jobs
   */
  async getAllJobUrls() {
    console.log('Getting Guru job URLs.');

    const categories = await getCategories(platform);

    return this.nightmare
      .goto(`${guruBaseUrl}/d/jobs`)
      .wait('body') // Job posting
      .evaluate(categories => {
        return [...document.querySelectorAll('li.serviceItem')]
          .filter(job => {
            const jobCategory = job.querySelector('ul.skills a:first-child').href.split('/')[6];
            return categories.find(category => category.href === jobCategory && category.selected);
          })
          .map(job => job.querySelector('h2.servTitle > a:first-child').href);
      }, categories)
      .then(allJobUrls => {
        console.log('Successfully fetched relevant Guru job URLs.');
        return allJobUrls;
      });
  }

  /**
   * Given the URLs of all the jobs to be processed,
   * return data only for the jobs that the user hasn't yet been notified about
   * 
   * @param {string[]} allJobUrls - Array of the URLs of all the jobs to be processed
   * @returns {Object[]} - Array of the data for every new job
   */
  async getNewJobs(allJobUrls) {
    console.log('Getting data for new Guru jobs.');

    const newJobUrls = await this.getNewJobUrls(allJobUrls);
    const newJobs = [];
    for (let i = 0; i < newJobUrls.length; i++) {
      newJobs.push(await this.getJobDetails(newJobUrls[i]));
    }

    console.log(newJobs.length ?
      'Successfully fetched data for all new Guru jobs.' :
      'No new Guru jobs.');
    return newJobs;
  }

  /**
   * Given the URLs of all the jobs to be processed,
   * filter only the ones that the user hasn't yet been notified about
   * 
   * @param {string[]} allJobUrls - Array of the URLs of all the jobs to be processed
   * @returns {string[]} - Array of the URLs of the new Guru jobs only
   */
  async getNewJobUrls(allJobUrls) {
    const lastJobProcessed = await getLastJobProcessed(platform);
    const newJobUrls = [];
    allJobUrls.every(jobLink => {
      if (!lastJobProcessed || !jobLink.includes(lastJobProcessed))
        return newJobUrls.push(jobLink);
    });
    return newJobUrls;
  }

  /**
   * Given a Guru job URL, parse all the relevant data and return it
   * 
   * @param {string} jobUrl - The URL of the Guru job to get data for
   * @returns {Object} - All the job data
   */
  getJobDetails(jobUrl) {
    return this.nightmare.goto(jobUrl)
      .wait('body')
      .evaluate(jobUrl => {
        const jobDetails = {
          id: jobUrl.split('/')[5].split('&')[0],
          url: jobUrl,
          title: document.querySelector('h1#ctl00_guB_hTitleAndAddtoWatchSec').innerText,
          description: document.querySelector('.section_desc.jobDetail-section').innerText,
          budget: document.querySelectorAll('div.budget > ul > li').length > 2 ? {
            type: 'Hourly Pay',
            daysNum: document.querySelector('div.budget > ul > li:first-child').innerText,
            hoursNum: document.querySelector('div.budget > ul > li:nth-child(2)').innerText,
            rate: document.querySelector('div.budget > ul > li:nth-child(3)').innerText.slice(6)
          } : {
              type: document.querySelector('div.budget > ul > li:first-child').innerText,
              amount: document.querySelector('div.budget > ul > li:nth-child(2)').innerText
            },
          skills: [...document.querySelectorAll('ul#ctl00_guB_ucProjectDetail_ulSkills > li')]
            .map(skill => skill.innerText),
          employer: {
            name: document.querySelector('h3.identityName').innerText,
            country: document.querySelector('p#ctl00_guB_divEmpLoc').innerText,
            feedback: document.querySelector('table.module_table tr:nth-child(2) > td.right').innerText,
            paid: document.querySelector('section#empStats > table tr td:nth-child(2)').innerText,
            paidJobs: document.querySelector('section#empStats > table tr:nth-child(4) td:nth-child(2)').innerText
          }
        }

        return jobDetails;
      }, jobUrl);
  }

  /**
   * Destroy the previously created Nightmare instance
   */
  endNightmare() {
    console.log('Closed Nightmare.');
    return this.nightmare.end();
  }

  /**
   * Get all categories directly parsed from Guru
   * 
   * @returns {Object[]} - Array of categories with their names and hrefs
   */
  fetchCategoriesFromGuru() {
    console.log('Fetching categories from Guru.');

    return this.nightmare.goto(`${guruBaseUrl}/d/jobs/`)
      .wait('body')
      .evaluate(() => {
        return [...document.querySelectorAll('ul#ctl00_guB_category a')].map(category => {
          return {
            name: category.innerText.split(' (')[0],
            href: category.href.split('/')[6]
          };
        });
      })
      .then(categories => {
        console.log('Successfully fetched categories from Guru.');
        return categories;
      });
  }
}