'use strict';
const bcrypt = require('bcrypt');
const {randomUUID}=require('node:crypto');
const {createSchoolDatabase,openSchoolDatabase} = require('./community-databases');

module.exports = function communityIndex(db, schema, tables) {
  const clients = new Map();
  const fail = (message,status) => {throw Object.assign(Error(message),{status});};
  async function getSchoolClient(id) {
    id=Number(id);
    if(!Number.isSafeInteger(id)||id<1) fail('Community not found.',404);
    if(!clients.has(id)) {
      const pending=(async()=>{
        const school=await db.get('SELECT * FROM schools WHERE id=?',id);
        if(!school?.db_url || school.status!=='ready') fail('Community is unavailable.',503);
        return openSchoolDatabase({url:school.db_url,authToken:school.db_auth_token||undefined},schema);
      })();
      clients.set(id,pending);pending.catch(()=>clients.delete(id));
    }
    return clients.get(id);
  }
  async function migrateLegacySchools() {
    const schools=await db.all("SELECT * FROM schools WHERE status='legacy' OR (status='migrating' AND migration_started_at<datetime('now','-10 minutes'))");
    if(!schools.length)return;
    const password=process.env.COFFEEHOUSE_LEGACY_JOIN_PASSWORD;
    validate('Legacy community',password);
    const hash=await bcrypt.hash(password,12);
    for(const school of schools) {
      const owner=randomUUID();let target;
      const claim=await db.run("UPDATE schools SET status='migrating',migration_owner=?,migration_started_at=datetime('now') WHERE id=? AND (status='legacy' OR (status='migrating' AND migration_started_at<datetime('now','-10 minutes')))",owner,school.id);
      if(!claim.changes)continue;
      try {
        const credentials=await createSchoolDatabase(school.id);
        target=await openSchoolDatabase(credentials,schema);
        const existing=new Set((await db.mainClient.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(r=>r.name));
        for(const table of tables) {
          if(!existing.has(table))continue;
          let where;
          if(['messages','matcha_gifts','personal_groups','message_reads','ai_pending'].includes(table))where='school_id=?';
          else if(table==='message_attachments')where='message_id IN (SELECT id FROM messages WHERE school_id=?)';
          else if(table==='personal_group_members')where='group_id IN (SELECT id FROM personal_groups WHERE school_id=?)';
          else where='user_id IN (SELECT user_id FROM memberships WHERE school_id=?)';
          const rows=(await db.mainClient.execute({sql:`SELECT * FROM ${table} WHERE ${where}`,args:[school.id]})).rows;
          for(const row of rows){const keys=Object.keys(row);await target.execute({sql:`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,args:keys.map(k=>row[k])});}
        }
        await db.run("UPDATE schools SET db_url=?,db_auth_token=?,join_password_hash=?,status='ready',migration_owner=NULL,migration_started_at=NULL WHERE id=? AND migration_owner=?",credentials.url,credentials.authToken||null,hash,school.id,owner);
      }catch(error){await db.run("UPDATE schools SET status='legacy',migration_owner=NULL,migration_started_at=NULL WHERE id=? AND migration_owner=?",school.id,owner);throw error;}finally{target?.close();}
    }
  }
  function validate(name,password) {
    if(typeof name!=='string'||!name.trim()||name.trim().length>80||/[\u0000-\u001f\u007f]/.test(name))fail('Enter a community name of 1–80 characters.',400);
    if(typeof password!=='string'||password.length<8||password.length>64||Buffer.byteLength(password)>72)fail('Use a password of 8–64 characters (at most 72 UTF-8 bytes). For migration, set COFFEEHOUSE_LEGACY_JOIN_PASSWORD.',400);
    return name.trim();
  }
  async function createCommunity(userId,name,password) {
    name=validate(name,password);
    const hash=await bcrypt.hash(password,12),tx=await db.mainClient.transaction('write');let id;
    try {
      const recent=(await tx.execute({sql:"SELECT id FROM schools WHERE created_by=? AND status!='failed' AND created_at>datetime('now','-24 hours')",args:[userId]})).rows[0];
      if(recent)fail('You can create one community every 24 hours.',429);
      const retry=(await tx.execute({sql:"SELECT id FROM schools WHERE name=? AND created_by=? AND status='failed'",args:[name,userId]})).rows[0];
      if(retry){
        id=retry.id;
        await tx.execute({sql:"UPDATE schools SET status='provisioning',join_password_hash=?,created_at=datetime('now') WHERE id=?",args:[hash,id]});
      }else{
        const result=await tx.execute({sql:"INSERT INTO schools(name,created_by,join_password_hash,created_at,status) VALUES(?,?,?,datetime('now'),'provisioning')",args:[name,userId,hash]});
        id=Number(result.lastInsertRowid);
      }
      await tx.commit();
    }catch(error){await tx.rollback();if(error.message.includes('UNIQUE'))fail('That community name is already taken.',409);throw error;}finally{tx.close();}
    let target;
    try {
      const credentials=await createSchoolDatabase(id);target=await openSchoolDatabase(credentials,schema);
      await db.mainClient.batch([
        {sql:"UPDATE schools SET db_url=?,db_auth_token=?,status='ready' WHERE id=?",args:[credentials.url,credentials.authToken||null,id]},
        {sql:'DELETE FROM memberships WHERE user_id=?',args:[userId]},
        {sql:'INSERT INTO memberships(user_id,school_id) VALUES(?,?)',args:[userId,id]}
      ],'write');
      return {id,name,dbUrl:credentials.url};
    }catch(error){await db.run("UPDATE schools SET status='failed' WHERE id=?",id);throw error;}finally{target?.close();}
  }
  async function joinCommunity(userId,{name,schoolId,password}) {
    if(typeof password!=='string'||password.length>64||Buffer.byteLength(password)>72)fail('Incorrect community password.',403);
    const school=typeof name==='string'?await db.get("SELECT * FROM schools WHERE name=? AND status!='failed'",name.trim()):await db.get("SELECT * FROM schools WHERE id=? AND status!='failed'",Number(schoolId)||0);
    if(school && school.status!=='ready')fail('This community is still being set up. Please try again later.',503);
    if(!school||!await bcrypt.compare(password,school.join_password_hash))fail('Unknown community or incorrect password.',403);
    await getSchoolClient(school.id);await db.setUserSchool(userId,school.id);
    return {id:school.id,name:school.name};
  }
  async function closeSchoolClients(){for(const promise of clients.values())try{(await promise).close();}catch{} clients.clear();}
  return {getSchoolClient,createCommunity,joinCommunity,migrateLegacySchools,closeSchoolClients};
};
