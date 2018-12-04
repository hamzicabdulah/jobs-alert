/** Imports */
const path = require('path');
const Nightmare = require('nightmare');
const jsonfile = require('jsonfile');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const guruBaseUrl = 'https://www.guru.com';
const databasePath = path.resolve(__dirname, '../data/database.json');

/** Class containing any code related to Guru */
module.exports = class Guru {

  /**
   * Create a new instance of Nightmare
   */
  startNightmare() {
    this.nightmare = Nightmare({ show: false })
  }

  /**
   * Log in to Guru
   */
  login() {
    const usernameInput = 'input#ctl00_ContentPlaceHolder1_ucLogin_txtUserName_txtUserName_TextBox';
    const passwordInput = 'input#ctl00_ContentPlaceHolder1_ucLogin_txtPassword_txtPassword_TextBox';
    const signInButton = 'input#ctl00_ContentPlaceHolder1_btnLoginAccount_btnLoginAccount_Button';

    return this.nightmare.goto(`${guruBaseUrl}/login.aspx`)
      .wait('body')
      .insert(usernameInput, process.env.GURU_USERNAME)
      .insert(passwordInput, process.env.GURU_PASSWORD)
      .click(signInButton);
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
    const possibleSecurityAnswers = process.env.GURU_SECURITY_ANSWERS.split(',');

    for (let i = 0; i < possibleSecurityAnswers.length; i++) {
      await this.trySecurityAnswer(possibleSecurityAnswers[i]);
      if (!await this.requiresSecurityAnswer()) return;
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
  getAllJobUrls() {
    const selectedCategories = this.getSelectedCategories();

    return this.nightmare
      .goto(`${guruBaseUrl}/d/jobs`)
      .wait('body') // Job posting
      .evaluate(selectedCategories => {
        return [...document.querySelectorAll('li.serviceItem')]
          .filter(job => {
            const jobCategory = job.querySelector('ul.skills a:first-child').href.split('/')[6];
            return selectedCategories.includes(jobCategory);
          })
          .map(job => job.querySelector('h2.servTitle > a:first-child').href);
      }, selectedCategories);
  }

  /**
   * Get the href strings of the categories 
   * that the user has selected to be notified about
   * 
   * @returns {string[]} - Category href strings
   */
  getSelectedCategories() {
    const database = jsonfile.readFileSync(databasePath);
    return database.guru.selectedCategories;
  }

  /**
   * Given the URLs of all the jobs to be processed,
   * return data only for the jobs that the user hasn't yet been notified about
   * 
   * @param {string[]} allJobUrls - Array of the URLs of all the jobs to be processed
   * @returns {Object[]} - Array of the data for every new job
   */
  async getNewJobs(allJobUrls) {
    const newJobUrls = this.getNewJobUrls(allJobUrls);
    const newJobs = [];
    for (let i = 0; i < newJobUrls.length; i++) {
      newJobs.push(await this.getJobDetails(newJobUrls[i]));
    }
    return newJobs;
  }

  /**
   * Given the URLs of all the jobs to be processed,
   * filter only the ones that the user hasn't yet been notified about
   * 
   * @param {string[]} allJobUrls - Array of the URLs of all the jobs to be processed
   * @returns {string[]} - Array of the URLs of the new Guru jobs only
   */
  getNewJobUrls(allJobUrls) {
    const lastJobSent = this.getLastJobSent();
    const newJobUrls = [];
    allJobUrls.every(jobLink => {
      if (!jobLink.includes(lastJobSent)) {
        newJobUrls.push(jobLink);
        return true;
      }
    });
    return newJobUrls;
  }

  /**
   * Get the id of the last job that the user has been notified about
   * 
   * @returns {string} - Id of the last job that the user has been notified about
   */
  getLastJobSent() {
    const database = jsonfile.readFileSync(databasePath);
    return database.guru.lastJobSent;
  }

  /**
   * Given the data for the last Guru job, 
   * set its id as the value for lastJobSent in database.json
   * 
   * @param {Object} lastJob - Data for the last job posted on Guru
   */
  updateLastJobSent(lastJob) {
    const database = jsonfile.readFileSync(databasePath);
    database.guru.lastJobSent = lastJob.id;
    jsonfile.writeFile(databasePath, database, err => {
      if (err) console.error(err)
    });
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
          budget: {
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
    return this.nightmare.end();
  }

  /**
   * Get the href strings of all possible Guru categories
   * 
   * @returns {string[]} - Category href strings
   */
  getAllCategories() {
    const database = jsonfile.readFileSync(databasePath);
    return database.guru.categories;
  }

  /**
   * Update the selected categories in database.json with the given ones
   * The user will only get notified for jobs from the selected categories
   * 
   * @param {string[]} categories - New categories to select
   */
  selectCategories(categories) {
    const database = jsonfile.readFileSync(databasePath);
    database.guru.selectedCategories = categories;
    jsonfile.writeFile(databasePath, database, err => {
      if (err) console.error(err)
    });
  }
}