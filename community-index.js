'use strict';
const bcrypt = require('bcrypt');
const {randomUUID}=require('node:crypto');
const {openSchoolDatabase,deleteSchoolDatabase} = require('./community-databases');

const {sharedCommunityStore}=require('./shared-community-store');

module.exports = function communityIndex(db, schema, tables) {
  const clients = new Map();
  const deletions = new Map();
  const fail = (message,status) => {throw Object.assign(Error(message),{status});};
  async function getSchoolClient(id) {
    id=Number(id);
    if(!Number.isSafeInteger(id)||id<1) fail('Community not found.',404);
    // Recheck durable state even when this server instance has a cached client.
    const school=await db.get('SELECT * FROM schools WHERE id=?',id);
    if(!school || school.status!=='ready' || (school.storage_mode!=='shared' && !school.db_url)) fail('Community is unavailable.',503);
    if(!clients.has(id)) {
      const pending=(async()=>{
        if(school.storage_mode==='shared'){const store=sharedCommunityStore(db.mainClient,id,schema,tables);await store.initialize();return store;}
        return openSchoolDatabase({url:school.db_url,authToken:school.db_auth_token||undefined},schema);
      })();
      clients.set(id,pending);pending.catch(()=>clients.delete(id));
    }
    return clients.get(id);
  }
  async function migrateLegacySchools({schoolId}={}) {
    const schools=await db.all("SELECT * FROM schools WHERE storage_mode!='shared' AND (status IN ('legacy','ready') OR (status='migrating' AND migration_started_at<datetime('now','-10 minutes')))" + (schoolId ? ' AND id=?' : ''), ...(schoolId ? [schoolId] : []));
    for(const school of schools) {
      let hash=school.join_password_hash;
      if(!hash){validate(school.name,process.env.COFFEEHOUSE_LEGACY_JOIN_PASSWORD);hash=await bcrypt.hash(process.env.COFFEEHOUSE_LEGACY_JOIN_PASSWORD,12);}
      const owner=randomUUID();
      const claim=await db.run("UPDATE schools SET status='migrating',migration_owner=?,migration_started_at=datetime('now') WHERE id=? AND storage_mode!='shared' AND (status IN ('legacy','ready') OR (status='migrating' AND migration_started_at<datetime('now','-10 minutes')))",owner,school.id);
      if(!claim.changes)continue;
      let source;
      try {
        const cached=clients.get(Number(school.id));clients.delete(Number(school.id));if(cached)try{(await cached).close();}catch{}
        const legacy=!school.db_url;
        source=legacy?db.mainClient:await openSchoolDatabase({url:school.db_url,authToken:school.db_auth_token||undefined},schema);
        if(!legacy && school.db_url===db.mainUrl)throw Error('Refusing an unscoped import from the account database.');
        const target=sharedCommunityStore(db.mainClient,school.id,schema,tables);await target.initialize();
        const existing=new Set((await source.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(r=>r.name));
        for(const table of tables) {
          if(!existing.has(table))continue;
          let where='1=1',args=[];
          if(legacy){
            args=[school.id];
            if(['messages','matcha_gifts','personal_groups','message_reads','ai_pending'].includes(table))where='school_id=?';
            else if(table==='message_attachments')where='message_id IN (SELECT id FROM messages WHERE school_id=?)';
            else if(table==='personal_group_members')where='group_id IN (SELECT id FROM personal_groups WHERE school_id=?)';
            else if(table==='channels'){args=[];}
            else where='user_id IN (SELECT user_id FROM memberships WHERE school_id=?)';
          }
          const rows=(await source.execute({sql:`SELECT * FROM ${table} WHERE ${where}`,args})).rows;
          for(let offset=0;offset<rows.length;offset+=20)await target.batch(rows.slice(offset,offset+20).map(row=>{
            const keys=Object.keys(row);return {sql:`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,args:keys.map(k=>row[k])};
          }),'write');
          const count=Number((await target.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
          if(count!==rows.length)throw Error(`Community ${school.id}: ${table} copy count mismatch.`);
        }
        await db.run("UPDATE schools SET storage_mode='shared',db_url=NULL,db_auth_token=NULL,join_password_hash=?,status='ready',migration_owner=NULL,migration_started_at=NULL WHERE id=? AND migration_owner=?",hash,school.id,owner);
      }catch(error){await db.run("UPDATE schools SET status=?,migration_owner=NULL,migration_started_at=NULL WHERE id=? AND migration_owner=?",school.status==='migrating'?'legacy':school.status,school.id,owner);throw error;}
      finally{if(source && source!==db.mainClient)source.close();}
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
      target=sharedCommunityStore(db.mainClient,Number(id),schema,tables);await target.initialize();
      await db.mainClient.batch([
        {sql:"UPDATE schools SET storage_mode='shared',db_url=NULL,db_auth_token=NULL,status='ready' WHERE id=?",args:[id]},
        {sql:'DELETE FROM memberships WHERE user_id=?',args:[userId]},
        {sql:'INSERT INTO memberships(user_id,school_id) VALUES(?,?)',args:[userId,id]}
      ],'write');
      return {id,name};
    }catch(error){await db.run("UPDATE schools SET status='failed' WHERE id=?",id);throw error;}finally{target?.close();}
  }
  async function joinCommunity(userId,{name,schoolId,password}) {
    if(typeof password!=='string'||password.length>64||Buffer.byteLength(password)>72)fail('Incorrect community password.',403);
    const school=typeof name==='string'?await db.get("SELECT * FROM schools WHERE name=? AND status NOT IN ('failed','deleted')",name.trim()):await db.get("SELECT * FROM schools WHERE id=? AND status NOT IN ('failed','deleted')",Number(schoolId)||0);
    if(school && school.status!=='ready')fail('This community is still being set up. Please try again later.',503);
    if(!school||!await bcrypt.compare(password,school.join_password_hash))fail('Unknown community or incorrect password.',403);
    await getSchoolClient(school.id);await db.setUserSchool(userId,school.id);
    return {id:school.id,name:school.name};
  }
  async function deleteCommunity(userId,schoolId,confirmName) {
    const id=Number(schoolId);
    if(!Number.isSafeInteger(id)||id<1)fail('Community not found.',404);
    const school=await db.get('SELECT * FROM schools WHERE id=?',id);
    if(!school)fail('Community not found.',404);
    if(school.created_by!==userId)fail('Only the community owner can delete it.',403);
    if(typeof confirmName!=='string'||confirmName!==school.name)fail('Type the community name exactly to confirm deletion.',400);
    if(school.status==='deleted')return {ok:true};
    if(school.storage_mode!=='shared' && school.db_url===db.mainUrl)fail('The account database cannot be deleted as a community.',409);
    if(!['ready','deleting'].includes(school.status))fail('This community cannot be deleted while it is being set up.',409);
    if(!deletions.has(id)) {
      const pending=(async()=>{
        // Keep a durable tombstone on failure so other instances cannot reopen
        // or join the database while deletion is incomplete. The owner can retry.
        await db.run("UPDATE schools SET status='deleting' WHERE id=? AND status='ready'",id);
        const cached=clients.get(id);clients.delete(id);
        if(cached)try{(await cached).close();}catch{}
        if(school.storage_mode==='shared')await sharedCommunityStore(db.mainClient,id,schema,tables).drop();
        else await deleteSchoolDatabase(school,tables);
        await db.mainClient.batch([
          {sql:'DELETE FROM memberships WHERE school_id=?',args:[id]},
          {sql:"UPDATE schools SET status='deleted',db_url=NULL,db_auth_token=NULL,join_password_hash=NULL WHERE id=?",args:[id]}
        ],'write');
        // Retain only index metadata to prevent seeded names reappearing and
        // preserve the daily creation limit after an owner deletes a community.
        return {ok:true};
      })();
      deletions.set(id,pending);
    }
    try{return await deletions.get(id);}finally{deletions.delete(id);}
  }
  async function closeSchoolClients(){for(const promise of clients.values())try{(await promise).close();}catch{} clients.clear();}
  return {getSchoolClient,createCommunity,joinCommunity,deleteCommunity,migrateLegacySchools,closeSchoolClients};
};
