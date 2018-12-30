const mongooseStart = require('./database/mongooseStart');
const Freelancer = require('./platforms/freelancer');

(async function() {
  await mongooseStart();
  const freelancer = new Freelancer();
  const newJobs = await freelancer.getNewJobs();
  console.log(newJobs.map(job => job.title));
})()