/* Important: Current valid platform values: "Guru", "Freelancer" */

const Category = require('../models/category');
const LastJobProcessed = require('../models/lastJobProcessed');
const Keyword = require('../models/keyword');

/**
 * Get all the categories saved in the database for the given platform
 * 
 * @param {string} platform - Name of the website whose categories need to be returned
 * @returns {Object[]} - All categories with their name, href/id, platform and selected properties
 */
function getCategories(platform) {
  return new Promise((resolve, reject) => {
    Category.find({ platform }, (err, categories) => {
      if (err) return reject(err);
      if (!categories || !categories.length)
        return reject(`No ${platform} categories available.`);
      resolve(categories);
    });
  });
}

/**
 * Get the id of the last job on the given platform that the user has been notified about
 * 
 * @param {string} platform - Name of the website whose last job id needs to be returned
 * @returns {string} - Id of the last job that the user has been notified about
 */
function getLastJobProcessed(platform) {
  return new Promise((resolve, reject) => {
    LastJobProcessed.findOne({ platform }, (err, lastJobProcessed) => {
      if (err) return reject(err);
      if (!lastJobProcessed) return resolve('');
      resolve(lastJobProcessed.jobId);
    });
  });
}

/**
 * Given the data for the last job on the given platform, 
 * update the jobId of the lastJobProcessed in the database
 * 
 * @param {string} platform - Name of the website whose last job id needs to be updated
 * @param {Object} lastJob - Data for the last job posted on the given platform
 * @returns {Object} - Updated LastJobProcessed
 */
function updateLastJobProcessed(platform, lastJob) {
  return new Promise((resolve, reject) => {
    LastJobProcessed.updateOne({ platform }, {
      platform,
      jobId: lastJob.id
    }, {
        upsert: true,
        setDefaultsOnInsert: true
      }, (err, lastJobProcessed) => {
        if (err) return reject(err);
        resolve(lastJobProcessed);
      }
    );
  });
}

/**
 * Update the selected property of the category with the given categoryName
 * The user will only get notified for jobs from the selected categories
 * 
 * @param {string} platform - Name of the website that the category belongs to
 * @param {string} categoryName - Name of the category to select/unselect
 * @returns {Object} - Updated category with all of its data
 */
function flipCategorySelection(platform, categoryName) {
  return new Promise((resolve, reject) => {
    Category.findOne({
      platform,
      [platform === 'Freelancer' ? 'id' : 'href']: categoryName
    }, (err, category) => {
      if (err) return reject(err);
      if (!category) return reject();
      category.selected = !category.selected;
      category.save(err => {
        if (err) return reject(err);
        console.log(`Successfully (un)selected ${platform} category: ${categoryName}`);
        resolve(category);
      });
    });
  });
}


/**
 * Update the categories for the given platform in the database
 * 
 * @param {string} platform - Name of the website whose categories to change
 * @param {Object[]} categories - Array of categories with their names and hrefs/ids
 */
async function updateCategories(platform, categories) {
  console.log(`Updating ${platform} categories in database.`);

  Category.find({ platform }, (_err, existingCategories) => {
    Category.deleteMany({ platform }, async _err => {
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        console.log(category);
        const existingCategory = existingCategories.find(existingCategory => {
          return category.name === existingCategory.name &&
            platform === existingCategory.platform;
        });
        if (existingCategory) category.selected = existingCategory.selected;
        await addCategory(platform, category);
      }

      return console.log(`Successfully updated ${platform} categories in database.`);
    });
  });
}

/**
 * Add a new category to the database that belongs to the given platform
 * 
 * @param {string} platform - Name of the website whose categories to change
 * @param {Object} category - Category with its name and href/id (and optionally selected property)
 * @returns {Object} - Added category document with all of its data
 */
function addCategory(platform, category) {
  console.log(`Adding a new ${platform} category to the database: ${category.name}`);

  return new Promise((resolve, reject) => {
    const newCategory = new Category({
      ...category,
      platform
    });
    newCategory.save((err, document) => {
      if (err) return reject(err);
      console.log('Category successfully added.');
      resolve(document);
    });
  });
}

/**
 * Get all the keywords saved in the database for the given platform
 * 
 * @param {string} platform - Name of the website whose keywords need to be returned
 * @returns {Object[]} - All keyword objects with 2 properties: platform and value
 */
function getKeywords(platform) {
  return new Promise((resolve, reject) => {
    Keyword.find({ platform }, (err, keywords) => {
      if (err) return reject(err);
      if (!keywords || !keywords.length)
        return reject(`No ${platform} keywords available.`);
      resolve(keywords);
    });
  });
}

/**
 * Add a new keyword to the database that belongs to the given platform
 * 
 * @param {string} platform - Name of the website the keyword is to be added to
 * @param {string} keyword
 * @returns {Object} - Added keyword document with its 2 properties: platform and value
 */
function addKeyword(platform, keyword) {
  console.log(`Adding a new ${platform} keyword to the database: ${keyword}`);

  return new Promise((resolve, reject) => {
    const newKeyword = new Keyword({ platform, value: keyword });
    newKeyword.save((err, document) => {
      if (err) return reject(err);
      console.log('Keyword successfully added.');
      resolve(document);
    });
  });
}

/**
 * Remove a keyword from the database that belongs to the given platform
 * 
 * @param {string} platform - Name of the website the keyword is to be removed from
 * @param {string} keyword
 */
function removeKeyword(platform, keyword) {
  console.log(`Removing ${platform} keyword from the database: ${keyword}`);

  Keyword.deleteOne({ platform, value: keyword }, err => {
    if (err) return reject(err);
    console.log('Keyword successfully removed.');
    resolve();
  });
}

module.exports = {
  getCategories,
  getLastJobProcessed,
  updateLastJobProcessed,
  flipCategorySelection,
  updateCategories,
  getKeywords,
  addKeyword,
  removeKeyword
};