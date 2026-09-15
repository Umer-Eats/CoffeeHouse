'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('deleting either saved type is constrained by owner and item ID',async()=>{
  const calls=[];
  const context=vm.createContext({require:name=>name==='@libsql/client'?{createClient:()=>({execute:async query=>{calls.push(query);return {rowsAffected:1,lastInsertRowid:0};}})}:require(name),process:{env:{TURSO_DATABASE_URL:'file::memory:'}},__dirname:__dirname,module:{exports:{}}});
  vm.runInContext(read('db.js'),context);
  await context.module.exports.deleteBrewDoc(12,34);
  await context.module.exports.deleteCheatSheet(12,56);
  assert.match(calls[0].sql,/DELETE FROM brewed_docs WHERE id = \? AND user_id = \?/);
  assert.match(calls[1].sql,/DELETE FROM cheat_sheets WHERE id = \? AND user_id = \?/);
  assert.deepEqual(Array.from(calls[0].args),[34,12]);
  assert.deepEqual(Array.from(calls[1].args),[56,12]);
});
test('delete confirmation cancels safely, reports failure, and refreshes after success',async()=>{
  const element=()=>({children:[],addEventListener(event,fn){this[event]=fn;},setAttribute(){},appendChild(child){this.children.push(child);}});
  let confirmed=false,fail=false,requests=0,refreshes=0;
  const context=vm.createContext({window:{},document:{createElement:element},confirm:()=>confirmed,api:async()=>{requests++;if(fail)throw Error('offline');}});
  vm.runInContext(read('public/saved-items.js'),context);
  const controls=context.window.SavedItems.actions({id:1,title:'Notes'},'/api/brewer/docs',async()=>{refreshes++;});
  const [remove,status]=controls.children;
  await remove.click(); assert.equal(requests,0);
  confirmed=true;fail=true;await remove.click();assert.equal(remove.disabled,false);assert.match(status.textContent,/Could not delete/);
  fail=false;await remove.click();assert.equal(refreshes,1);
});
test('download uses rendered content and native offline math instead of external assets',()=>{
  const source=read('public/saved-items.js');
  new vm.Script(source);
  assert.match(source,/AIFormat.render\(doc.body\)/);
  assert.match(source,/querySelectorAll\('\.katex-html'\)/);
  assert.match(source,/text\/html;charset=utf-8/);
  assert.match(source,/URL.revokeObjectURL/);
});
