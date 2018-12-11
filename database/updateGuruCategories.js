const Guru = require('../platforms/guru');
const mongooseStart = require('./mongooseStart');
const { updateCategories } = require('.');

/**
 * Fetch categories from Guru's website and save them to the database
 */
(async function () {
  try {
    mongooseStart();
    const guru = new Guru();
    guru.startNightmare();
    const categories = await guru.fetchCategoriesFromGuru();
    await guru.endNightmare();
    updateCategories('Guru', categories);
  } catch (err) {
    console.error('Something went wrong while updating the Guru categories in the database.');
  }
})();