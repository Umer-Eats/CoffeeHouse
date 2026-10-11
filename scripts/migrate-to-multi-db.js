'use strict';
require('dotenv').config();
const db=require('../db');
(async()=>{
  try{await db.init();await db.migrateLegacySchools({schoolId:process.argv[2]?Number(process.argv[2]):undefined});console.log('Shared community database migration complete.');}
  catch(error){console.error('Migration failed:',error.message);process.exitCode=1;}
  finally{await db.closeSchoolClients();db.mainClient.close();}
})();
