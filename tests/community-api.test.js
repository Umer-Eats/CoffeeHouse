'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
test('authenticated community APIs isolate notes and saved focus progress',async()=>{
 const directory=fs.mkdtempSync(path.resolve(__dirname,'../data/api-test-'));
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,
  PORT:'0',DEV_LOGIN:'true',COOKIE_SECURE:'false',VERCEL:'',COFFEEHOUSE_SCHOOLS:'[]',
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
  assert.equal((await request('/api/school/create',null,{name:'Private',password:'password123'})).status,401);
  const a=await request('/api/auth/dev',null,{email:'a@example.test',name:'A'});
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
  const schools=await request('/api/schools',a.cookie);assert.deepEqual(Object.keys(schools.body[0]).sort(),['id','name']);
 }finally{
  if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('close',resolve));}
  for(const file of fs.readdirSync(directory))fs.unlinkSync(path.join(directory,file));fs.rmdirSync(directory);
 }
});
