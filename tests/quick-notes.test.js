const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {quickNotes}=require('../quick-notes');

test('private notes persist edits, reject stale writes, and isolate users',async()=>{
  const context=vm.createContext({require,process:{env:{TURSO_DATABASE_URL:'file::memory:'}},__dirname,module:{exports:{}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../db.js'),'utf8'),context);
  const db=context.module.exports;
  try{
    await db.init();
    const a=await db.upsertUser({sub:'notes-a',email:'a@example.test',name:'A'});
    const b=await db.upsertUser({sub:'notes-b',email:'b@example.test',name:'B'});
    const notes=quickNotes(db),note=await notes.create(a.id);
    assert.equal(note.title,'');
    assert.equal((await notes.list(b.id)).length,0);
    const draft={title:'Biology homework',body:'Review cells\nFinish worksheet',revision:0};
    assert.deepEqual(await notes.save(a.id,note.id,draft),{revision:1});
    assert.equal((await notes.list(a.id))[0].body,draft.body);
    await assert.rejects(notes.save(a.id,note.id,draft),{status:409});
    await assert.rejects(notes.save(b.id,note.id,{...draft,revision:1}),{status:404});
    await notes.remove(b.id,note.id);
    assert.equal((await notes.list(a.id)).length,1);
    await assert.rejects(notes.save(a.id,note.id,{...draft,title:'x'.repeat(121)}),{status:400});
    await assert.rejects(notes.save(a.id,note.id,{...draft,body:'x'.repeat(100001)}),{status:400});
    await assert.rejects(notes.save(a.id,note.id,null),{status:400});
    await notes.remove(a.id,note.id);
    assert.equal((await notes.list(a.id)).length,0);
    await assert.rejects(notes.save(a.id,note.id,{...draft,revision:1}),{status:404});
  }finally{db.client.close();}
});
