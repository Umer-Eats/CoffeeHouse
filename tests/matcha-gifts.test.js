const test=require('node:test'),assert=require('node:assert/strict');
const {createClient}=require('@libsql/client');
const {gifts}=require('../matcha-gifts');
const menu=require('../public/matcha-menu');
const core=require('../public/matcha-core');
test('gift delivery, recipient access, server timing and exactly-once rewards',async()=>{
 const client=createClient({url:':memory:'});
 try{
 await client.execute('CREATE TABLE matcha_gifts(id TEXT PRIMARY KEY,school_id INTEGER,sender_id INTEGER,recipient_id INTEGER,drink_id TEXT,instructions TEXT,minutes INTEGER,started_at INTEGER,completed INTEGER DEFAULT 0)');
 await client.execute('CREATE TABLE messages(id INTEGER PRIMARY KEY,school_id INTEGER,channel TEXT,user_id INTEGER,text TEXT)');
 const db={client,get:async(sql,...args)=>(await client.execute({sql,args})).rows[0],all:async(sql,...args)=>(await client.execute({sql,args})).rows,run:async(sql,...args)=>client.execute({sql,args}),getUser:async id=>({id,is_bot:id===4}),getUserSchool:async id=>({id:id===3?2:1})};
 const service=gifts(db),body={recipientId:2,drinkId:menu.drinks[0].id,instructions:'Extra sago'};
 await assert.rejects(service.send(1,1,{...body,recipientId:1}));
 await assert.rejects(service.send(1,1,{...body,recipientId:3}));
 await assert.rejects(service.send(1,1,{...body,recipientId:4}));
 await assert.rejects(service.send(1,1,{...body,instructions:''}));
 const {id}=await service.send(1,1,body);
 const message=await db.get('SELECT * FROM messages');assert.equal(message.channel,'dm:2');assert.ok(message.text.includes(id));
 await assert.rejects(service.read(id,1,1));await assert.rejects(service.read(id,2,2));
 assert.equal((await service.read(id,2,1)).minutes,core.durationFor(menu.drinks[0].name));
 await assert.rejects(service.finish(id,2,1));
 const started=await service.start(id,2,1);assert.ok(started.started_at);assert.equal((await service.start(id,2,1)).started_at,started.started_at);
 await assert.rejects(service.finish(id,2,1));assert.equal((await service.rewards(1)).length,0);
 await service.cancel(id,2,1);assert.equal((await service.read(id,2,1)).started_at,null);await assert.rejects(service.finish(id,2,1));await service.start(id,2,1);
 await db.run('UPDATE matcha_gifts SET started_at=1 WHERE id=?',id);
 await Promise.all([service.finish(id,2,1),service.finish(id,2,1)]);
 for(const user of [1,2]){const rewards=await service.rewards(user);assert.equal(rewards.length,1);assert.equal(rewards[0].coupons,1);}
 assert.equal((await service.rewards(3)).length,0);
 }finally{client.close();}
});
