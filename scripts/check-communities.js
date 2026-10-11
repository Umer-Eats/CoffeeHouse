'use strict';
require('dotenv').config();
const {checkCommunityConfiguration} = require('../community-databases');
checkCommunityConfiguration().then(({mode}) => {
  console.log(`Community provisioning configuration verified (${mode}). No database was created.`);
}).catch(error => {
  console.error(`Community provisioning check failed [${error.code || 'UNKNOWN'}]: ${error.message}`);
  process.exitCode = 1;
});
