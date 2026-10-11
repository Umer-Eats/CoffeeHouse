'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
test('legacy communities without migration settings do not block pages, sign-in or new communities',async()=>{
 const directory=fs.mkdtempSync(path.resolve(__dirname,'../data/api-test-'));
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,
  PORT:'0',DEV_LOGIN:'true',COOKIE_SECURE:'false',VERCEL:'',COFFEEHOUSE_SCHOOLS:'["Legacy community"]',
  COFFEEHOUSE_LEGACY_JOIN_PASSWORD:'',TURSO_API_TOKEN:'',TURSO_ORG_NAME:'',
  TURSO_DATABASE_URL:'file:'+path.join(directory,'main.db'),TURSO_AUTH_TOKEN:'',TURSO_MULTI_DB_MODE:'local',COFFEEHOUSE_DATA_DIR:directory,
  FIREBASE_WEB_CONFIG:'',FIREBASE_SERVICE_ACCOUNT:'',FIREBASE_SERVICE_ACCOUNT_PATH:'',FIREBASE_SERVICE_ACCOUNT_B64:'',GOOGLE_APPLICATION_CREDENTIALS:''
 },stdio:['ignore','pipe','pipe']});
 try{
  const base=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Test server did not start.')),15000);
    child.once('exit',code=>{clearTimeout(timeout);reject(Error('Test server exited: '+code));});
    child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/localhost:(\d+)/);if(match){clearTimeout(timeout);resolve('http://localhost:'+match[1]);}});
  });
  const request=async(route,cookie,body,method)=>{
    const response=await fetch(base+route,{method:method||(body?'POST':'GET'),headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(home.headers.get('content-type'),/text\/html/);assert.match(await home.text(),/<!doctype html>/i);
  assert.equal((await request('/api/config')).status,200);
  const publicCatalog=await request('/api/schools');
  assert.equal(publicCatalog.status,200);
  assert.deepEqual(publicCatalog.body,[{id:1,name:'Legacy community',available:false}]);
  assert.equal((await request('/api/school/create',null,{name:'Private',password:'password123'})).status,401);
  const a=await request('/api/auth/dev',null,{email:'a@example.test',name:'A'});
  assert.equal(a.status,200);
  const settings=await fetch(base+'/settings.html',{headers:{Cookie:a.cookie}});assert.equal(settings.status,200);assert.match(settings.headers.get('content-type'),/text\/html/);
  const creationPage=await fetch(base+'/create-community.html',{headers:{Cookie:a.cookie}});assert.equal(creationPage.status,200);
  assert.equal((await request('/api/notes',a.cookie)).status,403);
  const first=await request('/api/school/create',a.cookie,{name:'API First',password:'password123'});assert.equal(first.status,201);
  assert.equal((await request('/api/school/create',a.cookie,{name:'Too soon',password:'password123'})).status,429);
  const note=await request('/api/notes',a.cookie,{});assert.equal(note.status,201);
  const progress={stamps:{sample:3}};
  assert.equal((await request('/api/matcha/progress',a.cookie,{schoolId:first.body.school.id,state:progress},'PUT')).status,200);
  const b=await request('/api/auth/dev',null,{email:'b@example.test',name:'B'});
  const second=await request('/api/school/create',b.cookie,{name:'API Second',password:'other password'});assert.equal(second.status,201);
  assert.equal((await request('/api/notes',b.cookie)).body.length,0);
  assert.equal((await request('/api/matcha/progress',b.cookie)).body.state,null);
  assert.equal((await request('/api/notes/'+note.body.id,b.cookie,{title:'Stolen',body:'no',revision:0},'PUT')).status,404);
  assert.equal((await request('/api/school/join',b.cookie,{name:'API First',password:'wrong'})).status,403);
  assert.equal((await request('/api/school/join',b.cookie,{name:'API First',password:'password123'})).status,200);
  assert.equal((await request('/api/notes',b.cookie)).body.length,0); // user privacy within a community
  assert.equal((await request('/api/matcha/progress',b.cookie,{schoolId:second.body.school.id,state:progress},'PUT')).status,409);
  assert.deepEqual((await request('/api/matcha/progress',a.cookie)).body.state,progress);
  const schools=await request('/api/schools');assert.deepEqual(Object.keys(schools.body[0]).sort(),['available','id','name']);
  assert.deepEqual(schools.body.map(s=>s.name),['API First','API Second','Legacy community']);
  assert.equal(schools.body.filter(s=>s.available).length,2);
  assert.equal((await request('/api/school/join',b.cookie,{schoolId:1,password:'any password'})).status,503);
  const route='/api/school/'+first.body.school.id;
  assert.equal((await request('/api/me',a.cookie)).body.school.isOwner,true);
  assert.equal((await request('/api/me',b.cookie)).body.school.isOwner,false);
  assert.equal((await request(route,null,{confirmName:'API First'},'DELETE')).status,401);
  assert.equal((await request(route,b.cookie,{confirmName:'API First'},'DELETE')).status,403);
  assert.equal((await request(route,a.cookie,{confirmName:'wrong name'},'DELETE')).status,400);
  assert.equal((await request(route,a.cookie,{confirmName:'API First'},'DELETE')).status,200);
  for(const cookie of [a.cookie,b.cookie]){
    const me=await request('/api/me',cookie);assert.equal(me.status,200);assert.ok(me.body.user.id);assert.equal(me.body.school,null);
    assert.equal((await request('/api/notes',cookie)).status,403);
  }
  assert.deepEqual((await request('/api/schools')).body.map(s=>s.name),['API Second','Legacy community']);
  assert.equal((await request('/api/school/join',b.cookie,{name:'API First',password:'password123'})).status,403);
  assert.equal((await request(route,a.cookie,{confirmName:'API First'},'DELETE')).status,200);
  assert.equal((await request('/api/school/create',a.cookie,{name:'Bypass daily limit',password:'password123'})).status,429);
 }finally{
  if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('close',resolve));}
  for(const file of fs.readdirSync(directory))fs.unlinkSync(path.join(directory,file));fs.rmdirSync(directory);
 }
});
