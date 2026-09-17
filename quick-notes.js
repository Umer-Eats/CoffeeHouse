'use strict';
const {randomUUID}=require('node:crypto');
function quickNotes(db){
  return {
    list(userId){return db.all('SELECT * FROM quick_notes WHERE user_id=? ORDER BY updated_at DESC,id',userId);},
    async create(userId){const id=randomUUID();await db.run('INSERT INTO quick_notes (id,user_id) VALUES (?,?)',id,userId);return db.get('SELECT * FROM quick_notes WHERE id=? AND user_id=?',id,userId);},
    async save(userId,id,input){
      if(typeof input?.title!=='string'||input.title.length>120||typeof input.body!=='string'||input.body.length>100000||!Number.isSafeInteger(input.revision)||input.revision<0)throw Object.assign(Error('Use a title up to 120 characters and a note up to 100,000 characters.'),{status:400});
      const result=await db.run("UPDATE quick_notes SET title=?,body=?,revision=revision+1,updated_at=datetime('now') WHERE id=? AND user_id=? AND revision=?",input.title,input.body,id,userId,input.revision);
      if(!result.changes){
        const exists=await db.get('SELECT id FROM quick_notes WHERE id=? AND user_id=?',id,userId);
        throw Object.assign(Error(exists?'This note changed in another window. Copy your draft before reopening it.':'This note is no longer available.'),{status:exists?409:404});
      }
      return {revision:input.revision+1};
    },
    async remove(userId,id){await db.run('DELETE FROM quick_notes WHERE id=? AND user_id=?',id,userId);}
  };
}
module.exports={quickNotes};
