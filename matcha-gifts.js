'use strict';
const {randomUUID}=require('node:crypto');
const menu=require('./public/matcha-menu');
const core=require('./public/matcha-core');
function gifts(db){
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
 async function read(id,user,school){const g=await db.get('SELECT * FROM matcha_gifts WHERE id=? AND recipient_id=? AND school_id=?',id,user,school);if(!g)fail('Gift not found.',404);return g;}
 return {
 async send(user,school,body){
  const d=menu.drinks.find(d=>d.id===body.drinkId),recipient=Number(body.recipientId);
  if(!d||!Number.isSafeInteger(recipient)||recipient===user)fail('Choose a drink and another student.');
  const partner=await db.getUser(recipient),membership=await db.getUserSchool(recipient);
  if(!partner||partner.is_bot||membership?.id!==school)fail('Choose a student in your community.',403);
  const instructions=String(body.instructions||'').trim();if(!instructions||instructions.length>300)fail('Add instructions of up to 300 characters.');
  const id=randomUUID();
  await db.client.batch([
   {sql:'INSERT INTO matcha_gifts(id,school_id,sender_id,recipient_id,drink_id,instructions,minutes) VALUES(?,?,?,?,?,?,?)',args:[id,school,user,recipient,d.id,instructions,core.durationFor(d.name)]},
   {sql:'INSERT INTO messages(school_id,channel,user_id,text) VALUES(?,?,?,?)',args:[school,'dm:'+recipient,user,'I sent you a Matcha Mode drink: '+d.name+'!\n[matcha-gift:'+id+']']}
  ],'write');return {id};
 },read,
 async cancel(id,user,school){await read(id,user,school);await db.run('UPDATE matcha_gifts SET started_at=NULL WHERE id=? AND completed=0',id);return {ok:true};},
 async start(id,user,school){await read(id,user,school);await db.run("UPDATE matcha_gifts SET started_at=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE id=? AND started_at IS NULL AND completed=0",id);return read(id,user,school);},
 async finish(id,user,school){const g=await read(id,user,school);await db.run("UPDATE matcha_gifts SET completed=1 WHERE id=? AND started_at IS NOT NULL AND started_at+minutes*60000<=CAST(strftime('%s','now') AS INTEGER)*1000",id);const result=await read(id,user,school);if(!result.completed)fail('This gift timer is not finished yet.');return result;},
 async rewards(user){return db.all('SELECT drink_id,COUNT(*) AS coupons FROM matcha_gifts WHERE completed=1 AND (sender_id=? OR recipient_id=?) GROUP BY drink_id',user,user);}
 };
}
module.exports={gifts};
