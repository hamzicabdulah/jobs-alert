const mongooseStart = require('./database/mongooseStart');
const Freelancer = require('./platforms/freelancer');
const freelancer = new Freelancer();
const { getKeywords, addKeyword } = require('./database');

(async function () {
  await mongooseStart();
  const keywords = ['bosnian', 'web', 'development', 'typescript', 'software', 'mongo', 'flutter', 'electron', 'scraping', 'slack', 'bot', 'autoit', 'automation', 'desktop', 'serbian', 'macedonian', 'react', 'angular', 'node', 'javascript', 'chrome', 'telegram']
  for (let i = 0; i < keywords.length; i++) {
    await addKeyword('Freelancer', keywords[i]);
  }
})()