'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createClient}=require('@libsql/client');
const {databaseFixture}=require('./database-fixture.cjs');
const {deleteSchoolDatabase}=require('../community-databases');

async function environment(values,run){
 const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]])),fetch=global.fetch;
 for(const [k,v] of Object.entries(values))process.env[k]=v;
 try{await run();}finally{global.fetch=fetch;for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
const platform={TURSO_MULTI_DB_MODE:'platform',TURSO_API_TOKEN:'private-platform-token',TURSO_ORG_NAME:'test-org'};
const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('owner deletion removes all community content and memberships, preserving other communities and accounts',async()=>{
 const {db,close}=await databaseFixture();
 try{
  const owner=await db.upsertUser({sub:'owner',email:'owner@test.example',name:'Owner'});
  const member=await db.upsertUser({sub:'member',email:'member@test.example',name:'Member'});
  await db.run('UPDATE schools SET created_by=? WHERE id=1',owner.id);
  await db.setUserSchool(owner.id,1);await db.setUserSchool(member.id,1);
  await db.withSchool(1,async()=>{
   await db.insertMessage(1,'channel:HALL:general',member.id,'Deleted message');
   await db.run('INSERT INTO quick_notes(id,user_id,title,body) VALUES(?,?,?,?)','private-note',member.id,'Deleted note','Private');
   await db.run('INSERT INTO matcha_progress(user_id,state) VALUES(?,?)',member.id,'{"stamps":{}}');
  });
  await db.withSchool(2,()=>db.insertMessage(2,'channel:HALL:general',owner.id,'Keep this message'));
  const school=await db.get('SELECT * FROM schools WHERE id=1');
  const directory=path.dirname(school.db_url.slice(5));
  await environment({COFFEEHOUSE_DATA_DIR:directory},async()=>{
   await assert.rejects(db.deleteCommunity(member.id,1,school.name),{status:403});
   await assert.rejects(db.deleteCommunity(owner.id,1,'wrong'),{status:400});
   await Promise.all([db.deleteCommunity(owner.id,1,school.name),db.deleteCommunity(owner.id,1,school.name)]);
  });
  assert.equal(await db.getUserSchool(owner.id),null);assert.equal(await db.getUserSchool(member.id),null);
  assert.ok(await db.getUser(owner.id));assert.ok(await db.getUser(member.id));
  const removed=await db.get('SELECT * FROM schools WHERE id=1');
  assert.equal(removed.status,'deleted');assert.equal(removed.db_url,null);assert.equal(removed.db_auth_token,null);assert.equal(removed.join_password_hash,null);
  assert.ok(!(await db.listSchools()).some(s=>s.id===1));
  await assert.rejects(db.getSchoolClient(1),{status:503});
  await assert.rejects(db.setUserSchool(owner.id,1),{status:503});
  await db.withSchool(2,async()=>assert.equal((await db.channelMessages(2,'channel:HALL:general'))[0].text,'Keep this message'));
  if(fs.existsSync(school.db_url.slice(5))){
   const empty=createClient({url:school.db_url});
   try{assert.equal((await empty.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.length,0);}finally{empty.close();}
  }
 }finally{await close();}
});

test('failed remote deletion blocks cached access and can resume after database deletion before index cleanup',async()=>{
 const {db,close}=await databaseFixture();
 try{
  const owner=await db.upsertUser({sub:'remote-owner',email:'remote-owner@test.example',name:'Remote Owner'});
  await db.run('UPDATE schools SET created_by=? WHERE id=1',owner.id);await db.setUserSchool(owner.id,1);
  await db.getSchoolClient(1); // Exercise invalidation of an already cached client.
  await db.run("UPDATE schools SET db_url='libsql://school.test.example' WHERE id=1");
  await environment(platform,async()=>{
   global.fetch=async(url,options)=>options.method==='DELETE'?response(403,{}):response(200,{database:{Hostname:'school.test.example'}});
   await assert.rejects(db.deleteCommunity(owner.id,1,'Test school'),{code:'COMMUNITY_PROVIDER_AUTH'});
   assert.equal((await db.get('SELECT status FROM schools WHERE id=1')).status,'deleting');
   assert.equal((await db.getUserSchool(owner.id)).id,1);
   assert.ok(!(await db.listSchools()).some(s=>s.id===1));
   await assert.rejects(db.getSchoolClient(1),{status:503});
   await assert.rejects(db.joinCommunity(owner.id,{schoolId:1,password:'anything'}),{status:503});
   global.fetch=async()=>response(404,{});
   await db.deleteCommunity(owner.id,1,'Test school');
   assert.equal((await db.get('SELECT status FROM schools WHERE id=1')).status,'deleted');
   assert.equal(await db.getUserSchool(owner.id),null);
  });
 }finally{await close();}
});

test('remote deletion verifies the stored database and local deletion refuses unrelated file targets',async()=>{
 await environment(platform,async()=>{
  const calls=[];
  global.fetch=async(url,options)=>{calls.push({url,options});return response(200,{database:{Hostname:'expected.test.example'}});};
  await assert.rejects(deleteSchoolDatabase({id:7,db_url:'libsql://main.test.example'},[]),{code:'COMMUNITY_DELETE_TARGET'});
  assert.ok(calls.every(c=>c.options.method==='GET'));
  await deleteSchoolDatabase({id:7,db_url:'libsql://expected.test.example'},[]);
  assert.equal(calls.at(-1).options.method,'DELETE');assert.match(calls.at(-1).url,/\/databases\/coffeehouse-school-7$/);
  await assert.rejects(deleteSchoolDatabase({id:7,db_url:'file:'+path.resolve('data/main.db')},[]),{code:'COMMUNITY_DELETE_TARGET'});
 });
});

test('an index entry pointing to the main account database cannot be deleted',async()=>{
 const {db,close}=await databaseFixture();
 try{
  const owner=await db.upsertUser({sub:'main-guard',email:'main-guard@test.example',name:'Owner'});
  const directory=path.dirname((await db.get('SELECT db_url FROM schools WHERE id=1')).db_url.slice(5));
  await db.run("UPDATE schools SET created_by=?,db_url=? WHERE id=1",owner.id,'file:'+path.join(directory,'main.db'));
  await assert.rejects(db.deleteCommunity(owner.id,1,'Test school'),{status:409});
  assert.ok(await db.getUser(owner.id));assert.equal((await db.get('SELECT status FROM schools WHERE id=1')).status,'ready');
 }finally{await close();}
});

test('owner UI requires exact name, supports cancel/retry, and hides deletion after changing to a member community',async()=>{
 const ids=['deleteCommunityDialog','communityOwnerActions','ownedCommunityName','deleteCommunityButton','communityDeleteStatus','deleteCommunityExpectedName','deleteCommunityName','deleteCommunityError','confirmDeleteCommunity','cancelDeleteCommunity','deleteCommunityForm'];
 const elements=Object.fromEntries(ids.map(id=>[id,{hidden:false,value:'',textContent:'',disabled:false,open:false,addEventListener(type,fn){this[type]=fn;},showModal(){this.open=true;},close(){this.open=false;},focus(){}}]));
 let requests=0,fail=true,destination=null;
 const context=vm.createContext({window:{},document:{getElementById:id=>elements[id]},localStorage:{removeItem(){}},location:{assign:url=>{destination=url;}},api:async(url,options)=>{requests++;assert.equal(url,'/api/school/1');assert.equal(options.body.confirmName,'Study Group');if(fail)throw Error('Try again');}});
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../public/settings-community.js'),'utf8'),context);
 const ui=context.window.CommunityDeletion,submit=()=>elements.deleteCommunityForm.submit({preventDefault(){}});
 ui.setCommunity({id:1,name:'Study Group',isOwner:true,status:'ready'},4);
 assert.equal(elements.communityOwnerActions.hidden,false);elements.deleteCommunityButton.click();
 assert.equal(elements.confirmDeleteCommunity.disabled,true);
 elements.deleteCommunityName.value='wrong';elements.deleteCommunityName.input();await submit();assert.equal(requests,0);
 elements.cancelDeleteCommunity.click();assert.equal(elements.deleteCommunityDialog.open,false);assert.equal(requests,0);
 elements.deleteCommunityButton.click();elements.deleteCommunityName.value='Study Group';elements.deleteCommunityName.input();await submit();
 assert.equal(requests,1);assert.equal(elements.deleteCommunityError.textContent,'Try again');assert.equal(elements.cancelDeleteCommunity.disabled,false);
 fail=false;await submit();assert.equal(destination,'/?login=1');assert.equal(elements.communityOwnerActions.hidden,true);
 ui.setCommunity({id:2,name:'Other Group',isOwner:false,status:'ready'},4);
 assert.equal(elements.communityOwnerActions.hidden,true);elements.deleteCommunityButton.click();await submit();assert.equal(requests,2);
});
