'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function home({logoutError=false,firebaseError=false}={}) {
 const elements=new Map();
 function element(selector){
  if(!elements.has(selector))elements.set(selector,{
   hidden:true,disabled:false,value:'',textContent:'',dataset:{},events:{},
   addEventListener(type,fn){this.events[type]=fn;},setAttribute(){},removeAttribute(){},
   querySelector(){return element(selector+' button');},closest(){return element(selector+' label');},
   showModal(){this.open=true;},close(){this.open=false;}
  });
  return elements.get(selector);
 }
 const calls=[],firebase={apps:[],initializeApp(){calls.push('initialize');this.apps.push({});},auth(){return {signOut:async()=>{calls.push('firebase logout');if(firebaseError)throw Error('Firebase unavailable');}};}};
 const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],documentElement:{dataset:{theme:'dark'}}},window:{firebase},firebase,URLSearchParams,localStorage:{setItem(){}},location:{search:'?login=1',assign:url=>calls.push(url)},esc:String,api:async(url)=>{
  calls.push(url);
  if(url==='/api/config')return {firebaseConfigured:true,firebase:{},devLogin:false};
  if(url==='/api/me')return {user:{name:'Student'},school:null};
  if(url==='/api/schools')return [{id:1,name:'School',available:true}];
  if(url==='/api/logout'&&logoutError)throw Error('Offline');
  return {ok:true};
 }});
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../public/home.js'),'utf8'),context);
 return {element,calls,ready:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}

test('restored account without a community can clear both sessions and return to sign-in',async()=>{
 const app=home();await app.ready();
 const button=app.element('#accountLogout');assert.equal(button.hidden,false);
 app.element('#schoolPassword').value='private password';
 await button.events.click();
 assert.deepEqual(app.calls.slice(-4),['/api/logout','initialize','firebase logout','/?login=1']);
 assert.equal(app.element('#schoolPassword').value,'');
});

test('failed server logout stays visible and retryable; Firebase failure does not trap a cleared session',async()=>{
 const offline=home({logoutError:true});await offline.ready();await offline.element('#accountLogout').events.click();
 assert.equal(offline.element('#accountLogout').disabled,false);
 assert.match(offline.element('#loginStatus').textContent,/Could not log out: Offline/);
 assert.ok(!offline.calls.includes('/?login=1'));
 const firebase=home({firebaseError:true});await firebase.ready();await firebase.element('#accountLogout').events.click();
 assert.equal(firebase.calls.at(-1),'/?login=1');
});
