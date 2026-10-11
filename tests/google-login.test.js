'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {databaseFixture}=require('./database-fixture.cjs');

test('verified Google accounts outside Pines Charter can sign in; invalid tokens cannot',async()=>{
  const {db,close}=await databaseFixture();
  const filename=path.resolve(__dirname,'../server.js'),load=createRequire(filename);
  const accounts={gmail:{uid:'google-gmail',email:'reader@gmail.com',name:'Gmail reader'},other:{uid:'google-other',email:'reader@another-school.edu',name:'Other school'},missing:{uid:'no-email'}};
  const verified=[];
  const firebaseAuth={verifyIdToken:async token=>{verified.push(token);if(!accounts[token])throw Error('Invalid token');return accounts[token];}};
  const context=vm.createContext({
    require:name=>name==='./db'?db:name==='dotenv'?{config(){}}:name==='firebase-admin/app'?{initializeApp:()=>({}),cert:()=>({})}:name==='firebase-admin/auth'?{getAuth:()=>firebaseAuth}:load(name),
    __dirname:path.dirname(filename),process:{env:{VERCEL:'1',FIREBASE_SERVICE_ACCOUNT:'{}',FIREBASE_WEB_CONFIG:'{"apiKey":"test-only"}'}},module:{exports:{}},console:{log(){},error(){}},Buffer
  });
  vm.runInContext(fs.readFileSync(filename,'utf8'),context);
  const app=context.module.exports,server=app.listen(0);
  await new Promise(resolve=>server.once('listening',resolve));
  try{
    for(const token of ['gmail','other','invalid','missing']){
      const response=await fetch(`http://localhost:${server.address().port}/api/auth/firebase`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
      const body=await response.json();
      assert.equal(response.status,token==='invalid'?401:token==='missing'?403:200);
      if(['gmail','other'].includes(token)){
        assert.equal(body.user.email,accounts[token].email);
        assert.match(response.headers.get('set-cookie'),/ch_session=/);
        const session=response.headers.get('set-cookie').match(/ch_session=([^;]+)/)[1];
        assert.equal((await db.sessionUser(session)).email,accounts[token].email);
      }
    }
    assert.deepEqual(verified,['gmail','other','invalid','missing']);
  }finally{await new Promise(resolve=>server.close(resolve));await close();}
});
