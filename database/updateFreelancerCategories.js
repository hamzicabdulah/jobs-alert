const Freelancer = require('../platforms/freelancer');
const mongooseStart = require('./mongooseStart');
const { updateCategories } = require('.');

/**
 * Fetch categories from Freelancer's website and save them to the database
 */
(async function () {
  try {
    mongooseStart();
    const freelancer = new Freelancer();
    const categories = await freelancer.fetchCategoriesFromFreelancer();
    updateCategories('Freelancer', categories);
  } catch (err) {
    console.error('Something went wrong while updating the Freelancer categories in the database.');
  }
})();