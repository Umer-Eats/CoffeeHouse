const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const menu=require('../public/matcha-menu'),core=require('../public/matcha-core');
test('each category initially unlocks exactly its lowest-priced drink',()=>{
 const s=core.create(menu);
 for(const category of menu.categories){const rows=menu.drinks.filter(d=>d.category===category);assert.equal(rows.filter(d=>core.available(menu,s,d)).length,1);assert.equal(rows[0].price,Math.min(...rows.map(d=>d.price)));}
});
test('time prices range from 5 to 120 minutes in five-minute steps and persist',()=>{
 for(const value of [0,.25,.99999]){const s=core.create(menu,{},()=>value);assert.ok(Object.values(s.minutes).every(m=>m>=5&&m<=120&&m%5===0));assert.deepEqual(core.create(menu,JSON.parse(JSON.stringify(s))).minutes,s.minutes);}
});
test('locked orders and empty customization cannot start a timer',()=>{
 const s=core.create(menu),rows=menu.drinks.filter(d=>d.category==='Matcha');
 assert.throws(()=>core.order(menu,s,rows[1].id,'Sago'),/locked/);
 assert.throws(()=>core.order(menu,s,rows[0].id,' '),/addition/);
 assert.equal(s.active,null);
});
test('receipt tear starts the timer once; reload preserves end time; early cancel earns nothing',()=>{
 const s=core.create(menu,{},()=>0),id=menu.drinks[0].id;core.order(menu,s,id,'Less ice');assert.equal(core.finish(s,1e9),false);
 assert.equal(core.tear(s,1000),true);assert.equal(core.tear(s,9000),false);
 const restored=core.create(menu,JSON.parse(JSON.stringify(s)));assert.equal(restored.active.endAt,1000+s.minutes[id]*60000);assert.equal(core.finish(restored,1000+s.minutes[id]*60000-1),false);
 restored.active=null;assert.equal(core.finish(restored,999999),false);assert.equal(restored.stamps[id],0);
});
test('five completed orders unlock only the next drink on explicit, single-use redemption',()=>{
 const s=core.create(menu,{},()=>0),rows=menu.drinks.filter(d=>d.category==='Matcha'),id=rows[0].id;
 for(let i=0;i<5;i++){core.order(menu,s,id,'Sago');core.tear(s,0);assert.equal(core.finish(s,s.minutes[id]*60000),true);assert.equal(core.finish(s,s.minutes[id]*60000+900000),false);assert.equal(s.stamps[id],i+1);if(i<4)assert.equal(core.redeem(menu,s,id),null);}
 assert.equal(core.available(menu,s,rows[1]),false);assert.equal(core.redeem(menu,s,id).id,rows[1].id);assert.equal(core.available(menu,s,rows[1]),true);assert.equal(core.available(menu,s,rows[2]),false);assert.equal(core.redeem(menu,s,id),null);
});
test('all menu entries have distinct, existing original illustrations',()=>{
 assert.equal(new Set(menu.drinks.map(d=>d.art)).size,menu.drinks.length);
 const drawings=menu.drinks.map(d=>fs.readFileSync('public'+d.art,'utf8'));assert.equal(new Set(drawings).size,drawings.length);
});
test('malformed saved data recovers safely and completed sessions never credit twice after reload',()=>{
 assert.ok(core.create(menu,null));
 const s=core.create(menu,{},()=>0),id=menu.drinks[0].id;
 core.order(menu,s,id,'No ice');core.tear(s,0);core.finish(s,s.minutes[id]*60000);
 const restored=core.create(menu,JSON.parse(JSON.stringify(s)));
 assert.equal(core.finish(restored,s.minutes[id]*60000+900000),false);assert.equal(restored.stamps[id],1);
});
test('completing the last drink redeems a collection badge without an invalid next unlock',()=>{
 const s=core.create(menu),rows=menu.drinks.filter(d=>d.category==='Matcha'),id=rows.at(-1).id;
 s.stamps[id]=5;s.unlocked.Matcha=rows.length-1;
 assert.equal(core.redeem(menu,s,id),null);assert.equal(s.redeemed[id],true);assert.equal(s.unlocked.Matcha,rows.length-1);
});
test('drink durations are identical across users and migrate old saved prices without losing progress',()=>{
 const first=core.create(menu),id=menu.drinks[0].id;
 const second=core.create(menu,{minutes:{[id]:first.minutes[id]===5?120:5},stamps:{[id]:3},active:{drinkId:id,phase:'running',instructions:'Sago',startedAt:1000,endAt:999999}});
 assert.deepEqual(first.minutes,second.minutes);assert.equal(second.stamps[id],3);assert.equal(second.active.endAt,999999);
 assert.ok(new Set(Object.values(first.minutes)).size>10);
 for(const drink of menu.drinks)assert.equal(first.minutes[drink.id],core.durationFor(drink.name));
});
