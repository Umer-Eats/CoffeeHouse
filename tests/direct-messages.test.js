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
  } finally { db.client.close(); }
});
