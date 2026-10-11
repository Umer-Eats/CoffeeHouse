'use strict';
require('dotenv').config();
const db=require('../db');
(async()=>{
  try{await db.init();console.log('Community database migration complete.');}
  catch(error){console.error('Migration failed:',error.message);process.exitCode=1;}
  finally{await db.closeSchoolClients();db.mainClient.close();}
})();
