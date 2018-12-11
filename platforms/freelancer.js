/** Imports */
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});
const request = require('request-promise');
const { getCategories, getLastJobProcessed } = require('../database');

/** Constants */
const platform = 'Freelancer';

/** Class containing any code related to Freelancer */
module.exports = class Freelancer {
  /**
   * Get all new jobs from Freelancer's API with their data
   * 
   * @returns {Object[]} - Freelancer jobs with all of their data
   */
  async getNewJobs() {
    console.log('Getting new Freelancer jobs.');

    const selectedCategories = (await getCategories(platform)).filter(category => category.selected);
    if (!selectedCategories || !selectedCategories.length) {
      console.log('No Freelancer categories selected yet.');
      return [];
    }

    const skills = await this.getSkills(selectedCategories);
    const allJobs = (await this.apiGetRequest(
      `/projects/0.1/projects/active?full_description=true&job_details=true&` +
      `user_employer_reputation=true&limit=50&jobs[]=${skills.map(skill => skill.id).join(', ')}`,
    )).result.projects;

    const lastJobProcessed = await getLastJobProcessed(platform);
    const newJobs = lastJobProcessed ? allJobs.filter(job => job.id > lastJobProcessed) : allJobs;
    console.log(newJobs.length ?
      'Successfully fetched data for all new Freelancer jobs.' :
      'No new Freelancer jobs.');
    return newJobs;
  }

  /**
   * Get all skills (actually called jobs by Freelancer)
   * from Freelancer's API that belong to the given categories.
   * Jobs (actually called projects by Freelancer) are then searched based on these skills
   * 
   * @returns {Object[]} - Freelancer skills with their data (including an id property)
   */
  async getSkills(categories) {
    return (await this.apiGetRequest(
      `/projects/0.1/jobs?categories[]=${categories.map(category => category.id).join(', ')}`
    )).result;
  }

  /**
   * 
   * @param {string} route - The Freelancer API route to send a request to (e.g. '/projects/0.1/jobs')
   * @returns {Object} - The response received from Freelancer's API
   */
  apiGetRequest(route) {
    const options = {
      method: 'GET',
      uri: `https://www.freelancer.com/api${route}`,
      json: true,
      headers: {
        'freelancer-oauth-v1': process.env.FREELANCER_TOKEN
      }
    };

    return request(options);
  }

  /**
   * Get all categories directly parsed from Freelancer's API
   * 
   * @returns {Object[]} - Array of categories with their names, ids and other data
   */
  async fetchCategoriesFromFreelancer() {
    console.log('Fetching categories from Freelancer.');

    return (await this.apiGetRequest('/projects/0.1/categories/')).result.categories;
  }
}