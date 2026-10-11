'use strict';
require('dotenv').config();
const db=require('../db');
(async()=>{
 try{await db.mainClient.execute('SELECT 1');console.log('Shared community database connection verified.');}
 catch{console.error('Shared database connection failed. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');process.exitCode=1;}
 finally{db.mainClient.close();}
})();
