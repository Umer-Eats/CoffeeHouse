'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {databaseFixture}=require('./database-fixture.cjs');
const {quickNotes}=require('../quick-notes');
const bcrypt=require('bcrypt');

test('creation, bcrypt join, rate limits and physical isolation across concurrent requests',async()=>{
 const {db,close}=await databaseFixture();
 const original=process.env.COFFEEHOUSE_DATA_DIR;
 process.env.COFFEEHOUSE_DATA_DIR=path.dirname((await db.get('SELECT db_url FROM schools WHERE id=1')).db_url.slice(5));
 try{
  const users=[];
  for(const name of ['Creator','Other','Joiner'])users.push(await db.upsertUser({sub:name,email:name+'@example.test',name}));
  const [creator,other,joiner]=users;
  await assert.rejects(db.createCommunity(creator.id,'','password123'),{status:400});
  await assert.rejects(db.createCommunity(creator.id,'Invalid','short'),{status:400});
  const first=await db.createCommunity(creator.id,'First study group',' my secret phrase ');
  const second=await db.createCommunity(other.id,'Second study group','other secret phrase');
  assert.notEqual(first.dbUrl,second.dbUrl);
  const stored=await db.get('SELECT * FROM schools WHERE id=?',first.id);
  assert.equal(stored.created_by,creator.id);assert.equal(bcrypt.getRounds(stored.join_password_hash),12);
  assert.ok(await bcrypt.compare(' my secret phrase ',stored.join_password_hash));
  assert.equal((await db.getUserSchool(creator.id)).id,first.id);
  await assert.rejects(db.createCommunity(creator.id,'Too soon','password123'),{status:429});
  await assert.rejects(db.createCommunity(joiner.id,first.name,'password123'),{status:409});
  await assert.rejects(db.joinCommunity(joiner.id,{name:first.name,password:'wrong'}),{status:403});
  await db.joinCommunity(joiner.id,{name:first.name,password:' my secret phrase '});
  assert.equal((await db.getUserSchool(joiner.id)).id,first.id);
  assert.equal('db_auth_token' in (await db.listSchools())[0],false);
  await assert.rejects(db.all('SELECT * FROM messages'),/context is required/);
  const notes=quickNotes(db);
  const written=await Promise.all([first,second].map(school=>db.withSchool(school.id,async()=>{
    const msg=await db.insertMessage(school.id,'channel:HALL:general',creator.id,school.name);
    await db.run('INSERT INTO message_attachments(message_id,name,mime_type,data) VALUES(?,?,?,?)',msg.id,school.name,'text/plain','aGVsbG8=');
    const note=await notes.create(creator.id);await notes.save(creator.id,note.id,{title:school.name,body:school.name,revision:0});
    await db.addBrewDoc(creator.id,school.name,school.name,'test');
    await db.addCheatSheet(creator.id,school.name,school.name);
    await db.run('INSERT INTO matcha_progress(user_id,state) VALUES(?,?)',creator.id,JSON.stringify({community:school.id}));
    await db.heartbeat(creator.id);
    return {msg,note};
  })));
  // Identical message IDs in separate files must resolve only inside their file.
  assert.equal(written[0].msg.id,written[1].msg.id);
  for(const [index,school] of [first,second].entries())await db.withSchool(school.id,async()=>{
    assert.deepEqual(Array.from(await db.channelMessages(school.id,'channel:HALL:general'),m=>m.text),[school.name]);
    assert.equal((await db.get('SELECT name FROM message_attachments WHERE message_id=?',written[index].msg.id)).name,school.name);
    assert.equal((await notes.list(creator.id))[0].title,school.name);
    assert.equal(await db.get('SELECT * FROM quick_notes WHERE id=?',written[1-index].note.id),null);
    assert.equal((await db.listBrewDocs(creator.id))[0].title,school.name);
    assert.equal((await db.listCheatSheets(creator.id))[0].topic,school.name);
    assert.equal(JSON.parse((await db.get('SELECT state FROM matcha_progress WHERE user_id=?',creator.id)).state).community,school.id);
    await assert.rejects(db.createPersonalGroup(creator.id,school.id,'Foreign members',[other.id,joiner.id]),{status:400});
  });
  const mainTables=(await db.mainClient.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(r=>r.name);
  assert.ok(!mainTables.includes('messages'));assert.ok(!mainTables.includes('quick_notes'));
 }finally{if(original===undefined)delete process.env.COFFEEHOUSE_DATA_DIR;else process.env.COFFEEHOUSE_DATA_DIR=original;await close();}
});

test('Turso platform provisioning uses organization API and database-scoped tokens',async()=>{
 const previous={fetch:global.fetch,mode:process.env.TURSO_MULTI_DB_MODE,token:process.env.TURSO_API_TOKEN,org:process.env.TURSO_ORG_NAME};
 process.env.TURSO_MULTI_DB_MODE='platform';process.env.TURSO_API_TOKEN='test-token';process.env.TURSO_ORG_NAME='test-org';
 const calls=[];global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('/auth/tokens')?{jwt:'database-token'}:{database:{Hostname:'school.example.turso.io'}}};};
 try{
  const result=await require('../community-databases').createSchoolDatabase(42);
  assert.equal(result.url,'libsql://school.example.turso.io');assert.equal(result.authToken,'database-token');
  assert.equal(JSON.parse(calls[0].options.body).name,'coffeehouse-school-42');
  assert.match(calls[1].url,/databases\/coffeehouse-school-42\/auth\/tokens/);
  assert.equal(calls[0].options.headers.Authorization,'Bearer test-token');
 }finally{global.fetch=previous.fetch;for(const [key,value] of [['TURSO_MULTI_DB_MODE',previous.mode],['TURSO_API_TOKEN',previous.token],['TURSO_ORG_NAME',previous.org]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('legacy migration preserves message IDs and attachments without mixing communities',async()=>{
 const {db,close}=await databaseFixture();
 const previous={directory:process.env.COFFEEHOUSE_DATA_DIR,password:process.env.COFFEEHOUSE_LEGACY_JOIN_PASSWORD};
 process.env.COFFEEHOUSE_DATA_DIR=path.dirname((await db.get('SELECT db_url FROM schools WHERE id=1')).db_url.slice(5));
 process.env.COFFEEHOUSE_LEGACY_JOIN_PASSWORD='legacy secure phrase';
 try{
  const user=await db.upsertUser({sub:'legacy',email:'legacy@example.test',name:'Legacy'});await db.setUserSchool(user.id,1);
  await db.mainClient.executeMultiple(`
    CREATE TABLE messages(id INTEGER PRIMARY KEY,school_id INTEGER,channel TEXT,user_id INTEGER,text TEXT,created_at TEXT);
    CREATE TABLE message_attachments(message_id INTEGER PRIMARY KEY,name TEXT,mime_type TEXT,data TEXT);
    CREATE TABLE quick_notes(id TEXT PRIMARY KEY,user_id INTEGER,title TEXT,body TEXT,revision INTEGER,updated_at TEXT);
  `);
  for(const id of [1,2])await db.mainClient.execute({sql:'INSERT INTO messages VALUES(?,?,?,?,?,?)',args:[10+id,id,'channel:HALL:general',user.id,'Legacy '+id,'2026-01-01 12:00:00']});
  await db.mainClient.execute({sql:'INSERT INTO message_attachments VALUES(?,?,?,?)',args:[11,'legacy.txt','text/plain','aGVsbG8=']});
  await db.mainClient.execute({sql:'INSERT INTO quick_notes VALUES(?,?,?,?,?,?)',args:['legacy-note',user.id,'Legacy title','Legacy text',2,'2026-01-01 12:00:00']});
  await db.run("UPDATE schools SET status='legacy',db_url=NULL");
  await db.migrateLegacySchools();await db.migrateLegacySchools();
  for(const id of [1,2])await db.withSchool(id,async()=>{
    const messages=await db.channelMessages(id,'channel:HALL:general');assert.equal(messages.length,1);assert.equal(messages[0].id,10+id);
    assert.equal((await db.all('SELECT * FROM message_attachments')).length,id===1?1:0);
    assert.equal((await db.all('SELECT * FROM quick_notes')).length,id===1?1:0);
  });
  await db.joinCommunity(user.id,{schoolId:2,password:'legacy secure phrase'});
  assert.equal((await db.getUserSchool(user.id)).id,2);
 }finally{
  for(const [key,value] of [['COFFEEHOUSE_DATA_DIR',previous.directory],['COFFEEHOUSE_LEGACY_JOIN_PASSWORD',previous.password]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await close();
 }
});
