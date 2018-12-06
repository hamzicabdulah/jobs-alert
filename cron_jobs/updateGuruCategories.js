const Guru = require('../platforms/guru');
const guru = new Guru();
const mongooseStart = require('../config/mongooseStart');

(async function test() {
  mongooseStart();
  guru.startNightmare();
  const categories = await guru.fetchCategoriesFromGuru();
  guru.updateCategories(categories);
})();