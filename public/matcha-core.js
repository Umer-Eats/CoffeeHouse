(function(root){
'use strict';
function create(menu,saved={},random=Math.random){
 saved=saved&&typeof saved==='object'?saved:{};
 const state={version:1,minutes:{},stamps:{},unlocked:{},redeemed:{},active:null};
 const ids=new Set(menu.drinks.map(d=>d.id));
 for(const d of menu.drinks){
  const minutes=saved.minutes?.[d.id];
  state.minutes[d.id]=Number.isInteger(minutes)&&minutes>=5&&minutes<=120&&minutes%5===0?minutes:5*(1+Math.min(23,Math.floor(random()*24)));
  state.stamps[d.id]=Math.max(0,Math.min(5,Math.floor(Number(saved.stamps?.[d.id])||0)));
  state.redeemed[d.id]=saved.redeemed?.[d.id]===true;
 }
 for(const category of menu.categories){const rows=menu.drinks.filter(d=>d.category===category);state.unlocked[category]=Math.max(0,Math.min(rows.length-1,Math.floor(Number(saved.unlocked?.[category])||0)));}
 const a=saved.active;
 if(a&&ids.has(a.drinkId)&&['receipt','running','complete'].includes(a.phase)&&typeof a.instructions==='string'&&a.instructions.length<=300&&Number.isFinite(a.endAt)&&Number.isFinite(a.startedAt))state.active={...a};
 return state;
}
function available(menu,state,drink){return menu.drinks.filter(d=>d.category===drink.category).indexOf(drink)<=state.unlocked[drink.category];}
function order(menu,state,id,instructions){
 const drink=menu.drinks.find(d=>d.id===id);
 if(state.active&&state.active.phase!=='complete')throw Error('Finish or cancel your current order first.');
 if(!drink||!available(menu,state,drink))throw Error('This drink is still locked.');
 if(!String(instructions).trim())throw Error('Choose an addition or write a special instruction.');
 state.active={drinkId:id,instructions:String(instructions).trim().slice(0,300),phase:'receipt',startedAt:0,endAt:0};
}
function tear(state,now=Date.now()){if(state.active?.phase!=='receipt')return false;state.active.phase='running';state.active.startedAt=now;state.active.endAt=now+state.minutes[state.active.drinkId]*60000;return true;}
function finish(state,now=Date.now()){const a=state.active;if(a?.phase!=='running'||now<a.endAt)return false;a.phase='complete';state.stamps[a.drinkId]=Math.min(5,state.stamps[a.drinkId]+1);return true;}
function redeem(menu,state,id){
 const drink=menu.drinks.find(d=>d.id===id);if(!drink||state.stamps[id]<5||state.redeemed[id])return null;
 const rows=menu.drinks.filter(d=>d.category===drink.category),index=rows.indexOf(drink);
 state.redeemed[id]=true;state.unlocked[drink.category]=Math.max(state.unlocked[drink.category],Math.min(index+1,rows.length-1));
 return rows[index+1]||null;
}
const core={create,available,order,tear,finish,redeem};
if(typeof module!=='undefined')module.exports=core;else root.MatchaCore=core;
})(typeof window==='undefined'?{}:window);
