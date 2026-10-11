const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
async function databaseFixture(){
 const directory=fs.mkdtempSync(path.resolve(__dirname,'../data/test-'));
 const filename=path.resolve(__dirname,'../db.js');
 const context=vm.createContext({require:createRequire(filename),process:{env:{TURSO_DATABASE_URL:'file:'+path.join(directory,'main.db')}},__dirname:path.dirname(filename),module:{exports:{}}});
 vm.runInContext(fs.readFileSync(filename,'utf8'),context);const db=context.module.exports;await db.init();
 for(const [id,name] of [[1,'Test school'],[2,'Other school']])await db.run("INSERT INTO schools(id,name,db_url,status) VALUES(?,?,?,'ready')",id,name,'file:'+path.join(directory,`school-${id}.db`));
 return {db,close:async()=>{await db.closeSchoolClients();db.mainClient.close();try{for(const name of fs.readdirSync(directory))fs.unlinkSync(path.join(directory,name));fs.rmdirSync(directory);}catch(error){if(!['EBUSY','EPERM'].includes(error.code))throw error;}}};
}
module.exports={databaseFixture};
