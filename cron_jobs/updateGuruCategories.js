const Guru = require('../platforms/guru');
const guru = new Guru();
const mongooseStart = require('../config/mongooseStart');

/**
 * Fetch categories from Guru's website and save them to the database
 */
(async function () {
  try {
    mongooseStart();
    guru.startNightmare();
    const categories = await guru.fetchCategoriesFromGuru();
    await guru.endNightmare();
    guru.updateCategories(categories);
  } catch (err) {
    console.error('Something went wrong while updated the Guru categories in the database.');
  }
})();