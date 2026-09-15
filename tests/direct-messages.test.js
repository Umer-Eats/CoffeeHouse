const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('both participants see legacy and new DMs without seeing other conversations', async () => {
  const context = vm.createContext({require, process:{env:{TURSO_DATABASE_URL:'file::memory:'}}, __dirname, module:{exports:{}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../db.js'),'utf8'),context);
  const db=context.module.exports;
  try {
    await db.init();
    await db.run('INSERT INTO schools (id,name) VALUES (1,?), (2,?)','Test school','Other school');
    const users=[];
    for(const name of ['A','B','C']) users.push(await db.upsertUser({sub:name,email:name+'@example.test',name}));
    const [a,b,c]=users;
    await db.insertMessage(1,'dm:'+b.id,a.id,'A to B');
    await db.insertMessage(1,'dm:'+a.id,b.id,'B replies');
    await db.insertMessage(1,'dm:'+b.id,c.id,'C private');
    await db.insertMessage(2,'dm:'+b.id,a.id,'Other school');
    for(const [viewer,partner] of [[a,b],[b,a]]) {
      const messages=await db.directMessages(1,viewer.id,partner.id);
      assert.deepEqual(Array.from(messages,m=>m.text),['A to B','B replies']);
    }
    assert.equal((await db.directMessages(1,c.id,a.id)).length,0);
    const threads=await db.dmThreads(b.id,1);
    assert.equal(threads.length,2,JSON.stringify(threads));
    assert.equal(threads[0].partner_id,c.id);
    assert.equal(threads[1].partner_id,a.id);
    assert.equal(threads[1].n,2);
    const before = await db.unreadCounts(b.id,1);
    assert.equal(before.find(row=>row.channel==='dm:'+a.id).n,1);
    const latest = (await db.directMessages(1,b.id,a.id)).at(-1).id;
    await db.markMessagesRead(b.id,1,'dm:'+a.id,latest);
    assert.equal((await db.unreadCounts(b.id,1)).some(row=>row.channel==='dm:'+a.id),false);
    assert.equal((await db.unreadCounts(b.id,1)).find(row=>row.channel==='dm:'+c.id).n,1);
    await db.insertMessage(1,'dm:'+b.id,a.id,'New unread');
    assert.equal((await db.unreadCounts(b.id,1)).find(row=>row.channel==='dm:'+a.id).n,1);
    await db.markMessagesRead(b.id,1,'dm:'+a.id,1);
    assert.equal((await db.unreadCounts(b.id,1)).find(row=>row.channel==='dm:'+a.id).n,1);
    // Shared activity is scoped to the school and room, and concurrent requests
    // remain visible until the last request completes.
    const first=await db.insertMessage(1,'channel:hall:general',a.id,'@barista explain');
    const second=await db.insertMessage(1,'channel:hall:general',b.id,'@barista help');
    for(const msg of [first,second]) await db.run('INSERT INTO ai_pending (message_id,school_id,channel,kind) VALUES (?,1,?,?)',msg.id,'channel:hall:general','barista');
    const pending=(school,channel)=>db.all("SELECT DISTINCT kind FROM ai_pending WHERE school_id = ? AND channel = ? AND started_at > datetime('now','-2 minutes')",school,channel);
    assert.equal((await pending(1,'channel:hall:general')).length,1);
    assert.equal((await pending(2,'channel:hall:general')).length,0);
    assert.equal((await pending(1,'channel:hall:other')).length,0);
    await db.run('DELETE FROM ai_pending WHERE message_id = ?',first.id);
    assert.equal((await pending(1,'channel:hall:general')).length,1);
    await db.run("UPDATE ai_pending SET started_at = datetime('now','-3 minutes')");
    assert.equal((await pending(1,'channel:hall:general')).length,0);
  } finally { db.client.close(); }
});
