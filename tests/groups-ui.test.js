const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('group picker requires two students, requests a name, and closes after creation',async()=>{
  class Element{
    constructor(){this.children=[];this.value='';this.dataset={};this.classList={toggle(){}};}
    replaceChildren(){this.children=[];}append(...items){this.children.push(...items);}appendChild(item){this.children.push(item);}
    setAttribute(){}focus(){}showModal(){this.open=true;}close(){this.open=false;}querySelectorAll(){return [];}addEventListener(event,fn){this[event]=fn;}
  }
  const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  let saved,created;
  const context=vm.createContext({window:{},document:{getElementById:get,createElement:()=>new Element(),createTextNode:text=>text},setTimeout,clearTimeout,
    api:async(url,opts)=>{if(opts){saved=opts.body;return {id:'test',name:saved.name};}return {students:[{id:2,name:'Student two'},{id:3,name:'Student three'}],more:false};}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/groups.js'),'utf8'),context);
  context.window.GroupPicker.init(group=>{created=group;});get('createGroup').onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(get('groupDialog').open,true);assert.equal(get('groupAdd').disabled,true);
  const inputs=get('groupResults').children.map(label=>label.children[0]);
  inputs[0].checked=true;inputs[0].onchange();assert.equal(get('groupAdd').disabled,true);
  inputs[1].checked=true;inputs[1].onchange();assert.equal(get('groupAdd').disabled,false);
  get('groupAdd').onclick();assert.equal(get('groupNameStep').hidden,false);
  get('groupName').value='Biology';await get('groupNameStep').onsubmit({preventDefault(){}});
  assert.deepEqual(Array.from(saved.memberIds),[2,3]);assert.equal(created.name,'Biology');assert.equal(get('groupDialog').open,false);
});
