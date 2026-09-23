const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {messageNotifications}=require('../message-notifications');
test('notification feed excludes history, self, other schools and private conversations; cursors do not replay',async()=>{
 const context=vm.createContext({require,process:{env:{TURSO_DATABASE_URL:'file::memory:'}},__dirname,module:{exports:{}}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../db.js'),'utf8'),context);const db=context.module.exports;
 try{
 await db.init();await db.run('INSERT INTO schools(id,name) VALUES(1,?),(2,?)','One','Two');
 const users=[];for(const name of ['Alice','Bob','Cara','Outsider'])users.push(await db.upsertUser({sub:name,email:name+'@test.invalid',name}));const [a,b,c,o]=users;
 for(const u of [a,b,c])await db.run('INSERT INTO memberships(user_id,school_id) VALUES(?,1)',u.id);await db.run('INSERT INTO memberships(user_id,school_id) VALUES(?,2)',o.id);
 const channels=[{key:'channel:HALL:general',title:'General'}];
 await db.insertMessage(1,channels[0].key,b.id,'Old');const baseline=await messageNotifications(db,a.id,1,channels);assert.equal(baseline.messages.length,0);
 await db.insertMessage(1,channels[0].key,a.id,'Own message');await db.insertMessage(2,channels[0].key,o.id,'Other school');await db.insertMessage(1,'dm:'+c.id,b.id,'Private');await db.insertMessage(1,'dm:'+a.id,o.id,'Outside community');
 await db.insertMessage(1,'channel:personal:hidden',b.id,'Hidden group');
 await db.insertMessage(1,channels[0].key,b.id,'Hello everyone');await db.insertMessage(1,'dm:'+a.id,c.id,'Hello Alice');
 const group=await db.createPersonalGroup(a.id,1,'Study team',[b.id,c.id]);await db.insertMessage(1,group.channel,b.id,'Team hello');
 const result=await messageNotifications(db,a.id,1,channels,baseline.cursor);
 assert.deepEqual(result.messages.map(m=>m.text),['Hello everyone','Hello Alice','Team hello']);assert.equal(result.messages[1].channel,'dm:'+c.id);assert.equal(result.messages[2].title,'Study team');
 assert.equal((await messageNotifications(db,a.id,1,channels,result.cursor)).messages.length,0);
 await assert.rejects(messageNotifications(db,a.id,1,channels,'bad'),{status:400});
 }finally{db.client.close();}
});
