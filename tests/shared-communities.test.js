'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const bcrypt=require('bcrypt');
const {databaseFixture}=require('./database-fixture.cjs');

test('consolidation preserves separate database records, passwords and IDs and is repeatable',async()=>{
 const {db,close}=await databaseFixture();
 try{
  const user=await db.upsertUser({sub:'import',email:'import@example.test',name:'Import'});
  const hash=await bcrypt.hash('existing password',12);
  await db.run('UPDATE schools SET join_password_hash=?',hash);
  for(const id of [1,2])await db.withSchool(id,async()=>{
   const message=await db.insertMessage(id,'general',user.id,'Community '+id);
   await db.run('INSERT INTO message_attachments VALUES(?,?,?,?)',message.id,'file-'+id,'text/plain','aGVsbG8=');
   await db.run('INSERT INTO channels(name) VALUES(?)','Room '+id);
   await db.run('INSERT INTO matcha_progress(user_id,state) VALUES(?,?)',user.id,'state-'+id);
  });
  await db.migrateLegacySchools({schoolId:1});
  assert.equal((await db.get('SELECT storage_mode FROM schools WHERE id=2')).storage_mode,'separate');
  await db.migrateLegacySchools();await db.migrateLegacySchools();
  for(const id of [1,2]){
   const school=await db.get('SELECT * FROM schools WHERE id=?',id);
   assert.equal(school.storage_mode,'shared');assert.equal(school.db_url,null);
   assert.equal(school.join_password_hash,hash);
   await db.withSchool(id,async()=>{
    assert.equal((await db.all('SELECT * FROM messages'))[0].text,'Community '+id);
    assert.equal((await db.all('SELECT * FROM message_attachments'))[0].name,'file-'+id);
    assert.equal((await db.all('SELECT * FROM channels'))[0].name,'Room '+id);
    assert.equal((await db.all('SELECT * FROM matcha_progress'))[0].state,'state-'+id);
   });
  }
 }finally{await close();}
});

test('shared deletion removes only the selected namespace and keeps the main database usable',async()=>{
 const {db,close}=await databaseFixture();
 try{
  const users=await Promise.all(['one','two'].map(name=>db.upsertUser({sub:name,email:name+'@example.test',name})));
  const schools=[];
  for(const [i,user] of users.entries())schools.push(await db.createCommunity(user.id,'Shared '+i,'long password'));
  for(const school of schools)await db.withSchool(school.id,()=>db.insertMessage(school.id,'general',users[0].id,school.name));
  await db.deleteCommunity(users[0].id,schools[0].id,schools[0].name);
  const names=(await db.mainClient.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(row=>row.name);
  assert.ok(!names.some(name=>name.startsWith(`community_${schools[0].id}_`)));
  assert.ok(names.includes(`community_${schools[1].id}_messages`));
  await db.withSchool(schools[1].id,async()=>assert.equal((await db.all('SELECT * FROM messages'))[0].text,schools[1].name));
  assert.ok(await db.getUser(users[0].id));assert.ok(await db.getUser(users[1].id));
 }finally{await close();}
});
