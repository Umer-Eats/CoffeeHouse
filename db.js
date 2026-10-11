/* CoffeeHouse database layer — libSQL / Turso (works on Vercel serverless). */
'use strict';

const { createClient } = require('@libsql/client');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const {fileURLToPath} = require('node:url');
const {AsyncLocalStorage} = require('node:async_hooks');
const scope = new AsyncLocalStorage();

/* ---------------- client ---------------- */

const mainUrl=process.env.TURSO_DATABASE_URL || 'file:' + path.join(__dirname,'data','coffeehouse.db');
if(mainUrl.startsWith('file:') && !mainUrl.includes(':memory:')) {
  const filename=mainUrl.startsWith('file://')?fileURLToPath(mainUrl):mainUrl.slice(5);
  fs.mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});
}
const mainClient = createClient({
  url: mainUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const COMMUNITY_TABLES = ['channels','messages','matcha_gifts','matcha_progress','personal_groups','personal_group_members','message_attachments','message_reads','ai_pending','quick_notes','brewed_docs','cheat_sheets','online'];
function schoolContext() {
  const context=scope.getStore();
  if(!context) throw new Error('Community database context is required.');
  return context;
}
function queryClient(statement) {
  const sql=typeof statement==='string'?statement:statement.sql;
  return COMMUNITY_TABLES.some(table=>new RegExp('\\b'+table+'\\b','i').test(sql))?schoolContext().client:mainClient;
}
const client = {
  execute: statement=>queryClient(statement).execute(statement),
  batch: (statements,mode)=>{
    const target=queryClient(statements[0]);
    if(statements.some(statement=>queryClient(statement)!==target))throw new Error('Cannot batch across databases.');
    return target.batch(statements,mode);
  },
  close: ()=>mainClient.close()
};
async function withSchool(schoolId,fn) {
  return scope.run({schoolId:Number(schoolId),client:await communities.getSchoolClient(schoolId)},fn);
}
async function ensureSchoolSchema(client){await client.executeMultiple(schoolSchema);}

/* ---------------- schema ---------------- */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS matcha_gifts (
 id TEXT PRIMARY KEY, school_id INTEGER NOT NULL, sender_id INTEGER NOT NULL,
 recipient_id INTEGER NOT NULL, drink_id TEXT NOT NULL, instructions TEXT NOT NULL,
 minutes INTEGER NOT NULL, started_at INTEGER, completed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_display_names (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, school_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brewed_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  src TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cheat_sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS online (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(school_id, channel, id);
CREATE TABLE IF NOT EXISTS quick_notes (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quick_notes_owner ON quick_notes(user_id, updated_at);
CREATE TABLE IF NOT EXISTS personal_groups (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, school_id INTEGER NOT NULL REFERENCES schools(id),
  creator_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS personal_group_members (
  group_id TEXT NOT NULL REFERENCES personal_groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(group_id,user_id)
);
CREATE TABLE IF NOT EXISTS message_attachments (
  message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  name TEXT NOT NULL, mime_type TEXT NOT NULL, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS message_reads (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  last_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, school_id, channel)
);
CREATE TABLE IF NOT EXISTS ai_pending (
  message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  kind TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/* ---------------- explicitly configured communities and service identities ---------------- */

// Existing schools remain intact. New databases start empty unless configured.
const SCHOOLS = JSON.parse(process.env.COFFEEHOUSE_SCHOOLS || '[]');
if (!Array.isArray(SCHOOLS) || SCHOOLS.some(name => typeof name !== 'string' || !name.trim())) {
  throw new Error('COFFEEHOUSE_SCHOOLS must be a JSON array of school names.');
}

const BOTS = [
  { sub: 'bot-baristi', email: 'baristi@coffeehouse.ai', name: 'Baristi AI' },
  { sub: 'bot-brewer',  email: 'brewer@coffeehouse.ai',  name: 'Brewer AI' }
];

/* ---------------- init (call once per cold start) ---------------- */

const statements=SCHEMA.split(';').map(s=>s.trim()).filter(Boolean);
const mainTables=['users','user_display_names','schools','memberships','sessions'];
const isMain=sql=>mainTables.some(table=>sql.startsWith('CREATE TABLE IF NOT EXISTS '+table+' ('));
const mainSchema=statements.filter(isMain).join(';')+';';
// A request-local table namespace isolates community data in one database.
const schoolSchema=statements.filter(sql=>!isMain(sql)).map(sql=>sql.replace(/ REFERENCES (users|schools)\(id\)( ON DELETE CASCADE)?/g,'')).join(';')+`;
CREATE TABLE IF NOT EXISTS channels(name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS matcha_progress(user_id INTEGER PRIMARY KEY,state TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')));
`;
const communities=require('./community-index')({mainClient,mainUrl,get,run,all,setUserSchool},schoolSchema,COMMUNITY_TABLES);
let initialization;
async function init(){
  if(!initialization)initialization=initialize().catch(error=>{initialization=null;throw error;});
  return initialization;
}
async function initialize(){
  await mainClient.executeMultiple(mainSchema);
  const columns=(await mainClient.execute('PRAGMA table_info(schools)')).rows.map(c=>c.name);
  for(const [name,type] of Object.entries({storage_mode:"TEXT NOT NULL DEFAULT 'separate'",db_url:'TEXT',db_auth_token:'TEXT',created_by:'INTEGER REFERENCES users(id)',join_password_hash:'TEXT',created_at:'TEXT',status:"TEXT NOT NULL DEFAULT 'legacy'",migration_owner:'TEXT',migration_started_at:'TEXT'})){
    if(!columns.includes(name))try{await mainClient.execute(`ALTER TABLE schools ADD COLUMN ${name} ${type}`);}catch(error){if(!error.message.includes('duplicate column'))throw error;}
  }
  await mainClient.execute("UPDATE schools SET created_at=datetime('now') WHERE created_at IS NULL");
  for(const name of SCHOOLS)await mainClient.execute({sql:'INSERT OR IGNORE INTO schools(name) VALUES(?)',args:[name.trim()]});
  for(const b of BOTS)await mainClient.execute({sql:'INSERT OR IGNORE INTO users(firebase_uid,email,name,is_bot) VALUES(?,?,?,1)',args:[b.sub,b.email,b.name]});
  // Provisioning and legacy data copies are an explicit deployment step. Missing
  // platform credentials must not prevent account initialization or page loads.
}

/* ---------------- low-level helpers ---------------- */

async function all(sql, ...params) {
  const rs = await client.execute({ sql, args: params });
  return rs.rows;
}

async function get(sql, ...params) {
  const rs = await client.execute({ sql, args: params });
  return rs.rows[0] || null;
}

async function run(sql, ...params) {
  const rs = await client.execute({ sql, args: params });
  return { changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid) };
}

/* ---------------- queries ---------------- */

async function listSchools() {
  return all("SELECT id,name,status FROM schools WHERE status NOT IN ('failed','deleting','deleted') ORDER BY name COLLATE NOCASE");
}

async function upsertUser(profile) {
  const existing = await get('SELECT * FROM users WHERE firebase_uid = ?', profile.sub);
  if (existing) {
    await run(
      'UPDATE users SET email = ?, name = COALESCE((SELECT name FROM user_display_names WHERE user_id=users.id), ?), picture = COALESCE(?, picture) WHERE id = ?',
      profile.email, profile.name, profile.picture || null, existing.id
    );
    return get('SELECT * FROM users WHERE id = ?', existing.id);
  }
  const emailMatch = await get('SELECT * FROM users WHERE email = ?', profile.email);
  if (emailMatch) {
    await run(
      'UPDATE users SET firebase_uid = ?, name = COALESCE((SELECT name FROM user_display_names WHERE user_id=users.id), ?), picture = COALESCE(?, picture) WHERE id = ?',
      profile.sub, profile.name, profile.picture || null, emailMatch.id
    );
    return get('SELECT * FROM users WHERE id = ?', emailMatch.id);
  }
  const info = await run(
    'INSERT INTO users (firebase_uid, email, name, picture) VALUES (?, ?, ?, ?)',
    profile.sub, profile.email, profile.name, profile.picture || null
  );
  return get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
}

async function findBotByEmail(email) {
  return get('SELECT * FROM users WHERE email = ? AND is_bot = 1', email);
}

async function getUser(id) {
  return get('SELECT * FROM users WHERE id = ?', id);
}

async function getUserSchool(userId) {
  return get(
    `SELECT s.* FROM memberships m JOIN schools s ON s.id = m.school_id
     WHERE m.user_id = ? LIMIT 1`,
    userId
  );
}

async function setUserSchool(userId, schoolId) {
  const tx=await mainClient.transaction('write');
  try {
    const school=(await tx.execute({sql:"SELECT id FROM schools WHERE id=? AND status='ready'",args:[schoolId]})).rows[0];
    if(!school)throw Object.assign(new Error('Community is unavailable.'),{status:503});
    await tx.execute({sql:'DELETE FROM memberships WHERE user_id=?',args:[userId]});
    await tx.execute({sql:'INSERT INTO memberships(user_id,school_id) VALUES(?,?)',args:[userId,schoolId]});
    await tx.commit();
  }catch(error){await tx.rollback();throw error;}finally{tx.close();}
  return getUserSchool(userId);
}

async function createSession(userId, ttlMs) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + ttlMs).toISOString();
  await run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires);
  return token;
}

async function sessionUser(token) {
  if (!token) return null;
  const s = await get('SELECT * FROM sessions WHERE token = ?', token);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    await run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  return getUser(s.user_id);
}

async function destroySession(token) {
  if (token) await run('DELETE FROM sessions WHERE token = ?', token);
}

async function schoolStudents(schoolId, excludeUserId) {
  const rows = await all(
    `SELECT u.id, u.name, u.email, u.picture
     FROM memberships mb
     JOIN users u ON u.id = mb.user_id
     WHERE mb.school_id = ? AND u.is_bot = 0 AND u.id != ?
     ORDER BY u.name COLLATE NOCASE`,
    schoolId, excludeUserId
  );
  const results = [];
  for (const row of rows) {
    const o = await get('SELECT last_seen FROM online WHERE user_id = ?', row.id);
    const on = o && new Date(o.last_seen).getTime() > Date.now() - 90 * 1000;
    results.push({ id: row.id, name: row.name, email: row.email, picture: row.picture, on });
  }
  return results;
}

async function heartbeat(userId) {
  await run(
    'INSERT INTO online (user_id, last_seen) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen',
    userId, new Date().toISOString()
  );
}

async function channelMessages(schoolId, channel, limit = 200) {
  const rows = await all(
    `SELECT m.id, m.channel, m.text, m.created_at,
            m.user_id
     FROM messages m
     WHERE m.school_id = ? AND m.channel = ?
     ORDER BY m.id DESC LIMIT ?`,
    schoolId, channel, limit
  );
  return hydrateMessages(rows.reverse());
}

async function insertMessage(schoolId, channel, userId, text) {
  const info = await run(
    'INSERT INTO messages (school_id, channel, user_id, text) VALUES (?, ?, ?, ?)',
    schoolId, channel, userId, text
  );
  return hydrateMessage(await get(
    `SELECT m.id, m.channel, m.text, m.created_at,
            m.user_id
     FROM messages m
     WHERE m.id = ?`, info.lastInsertRowid
  ));
}

async function dmThreads(userId, schoolId) {
  return all(
    `SELECT CASE WHEN m.user_id = ? THEN CAST(substr(m.channel,4) AS INTEGER) ELSE m.user_id END AS partner_id,
            MAX(m.id) AS last_id, COUNT(*) AS n
     FROM messages m
     WHERE m.school_id = ? AND m.channel LIKE 'dm:%'
       AND (m.user_id = ? OR m.channel = ?)
     GROUP BY partner_id ORDER BY last_id DESC`,
    userId, schoolId, userId, 'dm:' + userId
  );
}

async function listPersonalGroups(userId) {
  return all(`SELECT g.id,g.name,g.school_id,g.creator_id,'channel:personal:' || g.id AS channel
    FROM personal_groups g JOIN personal_group_members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.created_at,g.id`,userId);
}
async function personalGroup(channel,userId) {
  return get(`SELECT g.* FROM personal_groups g JOIN personal_group_members m ON m.group_id=g.id
    WHERE g.id=? AND m.user_id=?`,channel.slice('channel:personal:'.length),userId);
}
async function createPersonalGroup(userId,schoolId,name,memberIds) {
  const ids=[...new Set(memberIds)];
  if(!name || name.length>80 || ids.length<2 || ids.includes(userId) || ids.some(id=>!Number.isSafeInteger(id)||id<1)) throw Object.assign(Error('Choose at least two other students and a name of 1–80 characters.'),{status:400});
  const users=await groupStudents(ids);
  if(users.length!==ids.length)throw Object.assign(Error('One or more students are unavailable.'),{status:400});
  const id=crypto.randomUUID();
  await client.batch([
    {sql:'INSERT INTO personal_groups (id,name,school_id,creator_id) VALUES (?,?,?,?)',args:[id,name,schoolId,userId]},
    ...[userId,...ids].map(member=>({sql:'INSERT INTO personal_group_members (group_id,user_id) VALUES (?,?)',args:[id,member]}))
  ],'write');
  return {id,name,creator_id:userId,channel:'channel:personal:'+id};
}
async function updateGroupMembers(userId,groupId,memberIds) {
  const group=await get('SELECT * FROM personal_groups WHERE id=? AND creator_id=?',groupId,userId);
  if(!group)throw Object.assign(Error('Only the group creator can edit members.'),{status:403});
  const ids=[...new Set(memberIds)];
  if(ids.some(id=>!Number.isSafeInteger(id)||id<1||id===userId))throw Object.assign(Error('Invalid member selection.'),{status:400});
  const users=ids.length?await groupStudents(ids):[];
  if(users.length!==ids.length)throw Object.assign(Error('One or more students are unavailable.'),{status:400});
  await client.batch([
    {sql:'DELETE FROM personal_group_members WHERE group_id=? AND user_id!=?',args:[groupId,userId]},
    ...ids.map(id=>({sql:'INSERT INTO personal_group_members (group_id,user_id) VALUES (?,?)',args:[groupId,id]}))
  ],'write');
  return {...group,channel:'channel:personal:'+group.id};
}
async function leavePersonalGroup(userId,groupId) {
  const group=await personalGroup('channel:personal:'+groupId,userId);
  if(!group)throw Object.assign(Error('Group not found.'),{status:404});
  if(group.creator_id===userId)throw Object.assign(Error('The creator must manage or delete the group instead.'),{status:403});
  await run('DELETE FROM personal_group_members WHERE group_id=? AND user_id=?',groupId,userId);
}
async function deletePersonalGroup(userId,groupId) {
  const group=await get('SELECT * FROM personal_groups WHERE id=? AND creator_id=?',groupId,userId);
  if(!group)throw Object.assign(Error('Only the group creator can delete this group.'),{status:403});
  const channel='channel:personal:'+groupId;
  await client.batch([
    {sql:'DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE school_id=? AND channel=?)',args:[group.school_id,channel]},
    {sql:'DELETE FROM ai_pending WHERE school_id=? AND channel=?',args:[group.school_id,channel]},
    {sql:'DELETE FROM message_reads WHERE school_id=? AND channel=?',args:[group.school_id,channel]},
    {sql:'DELETE FROM messages WHERE school_id=? AND channel=?',args:[group.school_id,channel]},
    {sql:'DELETE FROM personal_group_members WHERE group_id=?',args:[groupId]},
    {sql:'DELETE FROM personal_groups WHERE id=? AND creator_id=?',args:[groupId,userId]}
  ],'write');
}

async function unreadCounts(userId, schoolId) {
  return all(`SELECT incoming.conversation AS channel, COUNT(*) AS n FROM
    (SELECT id, CASE WHEN channel LIKE 'dm:%' THEN 'dm:' || user_id ELSE channel END AS conversation
     FROM messages WHERE school_id = ? AND user_id != ?
     AND ((channel LIKE 'channel:%' AND channel NOT LIKE 'channel:personal:%') OR channel = ?)) incoming
    LEFT JOIN message_reads r ON r.user_id = ? AND r.school_id = ? AND r.channel = incoming.conversation
    WHERE incoming.id > COALESCE(r.last_id,0) GROUP BY incoming.conversation`,
    schoolId, userId, 'dm:' + userId, userId, schoolId);
}

async function markMessagesRead(userId, schoolId, channel, lastId) {
  return run(`INSERT INTO message_reads (user_id,school_id,channel,last_id) VALUES (?,?,?,?)
    ON CONFLICT(user_id,school_id,channel) DO UPDATE SET last_id = MAX(last_id,excluded.last_id)`,
    userId, schoolId, channel, lastId);
}

async function directMessages(schoolId, userId, partnerId, limit = 200) {
  const rows = await all(
    `SELECT m.id, m.channel, m.text, m.created_at,
            m.user_id
     FROM messages m
     WHERE m.school_id = ? AND
       ((m.user_id = ? AND m.channel = ?) OR (m.user_id = ? AND m.channel = ?))
     ORDER BY m.id DESC LIMIT ?`,
    schoolId, userId, 'dm:' + partnerId, partnerId, 'dm:' + userId, limit
  );
  return hydrateMessages(rows.reverse());
}

async function addBrewDoc(userId, title, body, src) {
  const info = await run(
    'INSERT INTO brewed_docs (user_id, title, body, src) VALUES (?, ?, ?, ?)',
    userId, title, body, src
  );
  return get('SELECT * FROM brewed_docs WHERE id = ?', info.lastInsertRowid);
}

async function listBrewDocs(userId) {
  return all('SELECT * FROM brewed_docs WHERE user_id = ? ORDER BY id DESC', userId);
}

async function deleteBrewDoc(userId, id) {
  return run('DELETE FROM brewed_docs WHERE id = ? AND user_id = ?', id, userId);
}

async function deleteCheatSheet(userId, id) {
  return run('DELETE FROM cheat_sheets WHERE id = ? AND user_id = ?', id, userId);
}

async function addCheatSheet(userId, topic, content) {
  const info = await run(
    'INSERT INTO cheat_sheets (user_id, topic, content) VALUES (?, ?, ?)',
    userId, topic, content
  );
  return get('SELECT * FROM cheat_sheets WHERE id = ?', info.lastInsertRowid);
}

async function listCheatSheets(userId) {
  return all('SELECT * FROM cheat_sheets WHERE user_id = ? ORDER BY id DESC', userId);
}

async function hydrateMessage(message){
  if(!message)return null;
  const user=await getUser(message.user_id);
  return {...message,author:user?.name||'Former member',picture:user?.picture||null,is_bot:user?.is_bot||0};
}
async function hydrateMessages(messages){return Promise.all(messages.map(hydrateMessage));}
async function groupStudents(ids){return all('SELECT u.id FROM users u JOIN memberships mb ON mb.user_id=u.id WHERE mb.school_id=? AND u.is_bot=0 AND u.id IN ('+ids.map(()=>'?').join(',')+')',schoolContext().schoolId,...ids);}
async function groupMembers(groupId){
  const ids=await all('SELECT user_id FROM personal_group_members WHERE group_id=?',groupId);
  const users=await Promise.all(ids.map(row=>getUser(row.user_id)));
  return users.filter(Boolean).map(({id,name})=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));
}

module.exports = {
  client,
  mainClient,
  ensureSchoolSchema,
  withSchool,
  schoolContext,
  hydrateMessages,
  groupMembers,
  ...communities,
  init,
  get,
  run,
  all,
  listSchools,
  upsertUser,
  findBotByEmail,
  getUser,
  getUserSchool,
  setUserSchool,
  createSession,
  sessionUser,
  destroySession,
  schoolStudents,
  heartbeat,
  channelMessages,
  insertMessage,
  dmThreads,
  listPersonalGroups,
  personalGroup,
  createPersonalGroup,
  updateGroupMembers,
  leavePersonalGroup,
  deletePersonalGroup,
  unreadCounts,
  markMessagesRead,
  directMessages,
  addBrewDoc,
  listBrewDocs,
  deleteBrewDoc,
  deleteCheatSheet,
  addCheatSheet,
  listCheatSheets
};
