'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('deleting either saved type is constrained by owner and item ID',async()=>{
  const {db,close}=await require('./database-fixture.cjs').databaseFixture();
  try{await db.withSchool(1,async()=>{
    const a=await db.addBrewDoc(12,'A','Body','Source');
    const b=await db.addCheatSheet(12,'B','Content');
    await db.deleteBrewDoc(99,a.id);await db.deleteCheatSheet(99,b.id);
    assert.equal((await db.listBrewDocs(12)).length,1);
    assert.equal((await db.listCheatSheets(12)).length,1);
    await db.deleteBrewDoc(12,a.id);await db.deleteCheatSheet(12,b.id);
    assert.equal((await db.listBrewDocs(12)).length,0);
    assert.equal((await db.listCheatSheets(12)).length,0);
  });}finally{await close();}
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
  assert.match(source,/AIFormat.render\(doc\.body\)/);
  assert.match(source,/querySelectorAll\('\.katex-html'\)/);
  assert.match(source,/window\.open/);
  assert.match(source,/win\.document\.write\(html\)/);
  assert.match(source,/win\.print\(\)/);
});
