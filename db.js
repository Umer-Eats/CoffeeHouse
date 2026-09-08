/* CoffeeHouse database layer — uses Node's built-in SQLite (node:sqlite). */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'coffeehouse.db'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
`);

/* rename legacy google_sub column on old databases */
const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (userCols.includes('google_sub') && !userCols.includes('firebase_uid')) {
  db.exec('ALTER TABLE users RENAME COLUMN google_sub TO firebase_uid;');
}

/* ---------------- seed ---------------- */

const SCHOOLS = [
  'Pembroke Pines Charter High School',
  'American Heritage High School',
  'West Broward High School'
];

function seedSchools() {
  const ins = db.prepare('INSERT OR IGNORE INTO schools (name) VALUES (?)');
  for (const name of SCHOOLS) ins.run(name);
}

function seedBots() {
  const ins = db.prepare(
    `INSERT OR IGNORE INTO users (firebase_uid, email, name, is_bot)
     VALUES (?, ?, ?, 1)`
  );
  ins.run('bot-baristi', 'baristi@coffeehouse.ai', 'Baristi AI');
  ins.run('bot-brewer', 'brewer@coffeehouse.ai', 'Brewer AI');
}

seedSchools();
seedBots();

/* ---------------- helpers ---------------- */

function all(sql, ...params) { return db.prepare(sql).all(...params); }
function get(sql, ...params) { return db.prepare(sql).get(...params); }
function run(sql, ...params) { return db.prepare(sql).run(...params); }

/* ---------------- queries ---------------- */

function findSchoolByName(name) {
  return get('SELECT * FROM schools WHERE name = ?', name);
}

function listSchools() {
  return all('SELECT * FROM schools ORDER BY name');
}

function upsertUser(profile) {
  const existing = get('SELECT * FROM users WHERE firebase_uid = ?', profile.sub);
  if (existing) {
    run(
      'UPDATE users SET email = ?, name = ?, picture = COALESCE(?, picture) WHERE id = ?',
      profile.email, profile.name, profile.picture || null, existing.id
    );
    return get('SELECT * FROM users WHERE id = ?', existing.id);
  }
  const info = run(
    'INSERT INTO users (firebase_uid, email, name, picture) VALUES (?, ?, ?, ?)',
    profile.sub, profile.email, profile.name, profile.picture || null
  );
  return get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
}

function findUserByEmail(email) {
  return get('SELECT * FROM users WHERE email = ?', email);
}

function findBotByEmail(email) {
  return get('SELECT * FROM users WHERE email = ? AND is_bot = 1', email);
}

function getUser(id) {
  return get('SELECT * FROM users WHERE id = ?', id);
}

function getUserSchool(userId) {
  return get(
    `SELECT s.* FROM memberships m JOIN schools s ON s.id = m.school_id
     WHERE m.user_id = ? LIMIT 1`,
    userId
  );
}

function setUserSchool(userId, schoolId) {
  db.exec('BEGIN');
  try {
    run('DELETE FROM memberships WHERE user_id = ?', userId);
    run('INSERT INTO memberships (user_id, school_id) VALUES (?, ?)', userId, schoolId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return getUserSchool(userId);
}

function createSession(userId, ttlMs) {
  const token = require('node:crypto').randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + ttlMs).toISOString();
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires);
  return token;
}

function sessionUser(token) {
  if (!token) return null;
  const s = get('SELECT * FROM sessions WHERE token = ?', token);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  return getUser(s.user_id);
}

function destroySession(token) {
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
}

/* students in the same school (real accounts only), with online status */
function schoolStudents(schoolId, excludeUserId) {
  const rows = all(
    `SELECT u.id, u.name, u.email, u.picture
     FROM memberships mb
     JOIN users u ON u.id = mb.user_id
     WHERE mb.school_id = ? AND u.is_bot = 0 AND u.id != ?
     ORDER BY u.name COLLATE NOCASE`,
    schoolId, excludeUserId
  );
  return rows.map(row => {
    const o = get('SELECT last_seen FROM online WHERE user_id = ?', row.id);
    const on = o && new Date(o.last_seen).getTime() > Date.now() - 90 * 1000;
    return { id: row.id, name: row.name, email: row.email, picture: row.picture, on };
  });
}

function heartbeat(userId) {
  run('INSERT INTO online (user_id, last_seen) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen',
    userId, new Date().toISOString());
}

/* messages */

function channelMessages(schoolId, channel, limit = 200) {
  return all(
    `SELECT m.id, m.channel, m.text, m.created_at,
            u.id AS user_id, u.name AS author, u.picture, u.is_bot
     FROM messages m JOIN users u ON u.id = m.user_id
     WHERE m.school_id = ? AND m.channel = ?
     ORDER BY m.id DESC LIMIT ?`,
    schoolId, channel, limit
  ).reverse();
}

function insertMessage(schoolId, channel, userId, text) {
  const info = run(
    'INSERT INTO messages (school_id, channel, user_id, text) VALUES (?, ?, ?, ?)',
    schoolId, channel, userId, text
  );
  return get(
    `SELECT m.id, m.channel, m.text, m.created_at,
            u.id AS user_id, u.name AS author, u.picture, u.is_bot
     FROM messages m JOIN users u ON u.id = m.user_id
     WHERE m.id = ?`, info.lastInsertRowid
  );
}

function dmThreads(userId, schoolId) {
  return all(
    `SELECT m.channel, MAX(m.id) AS last_id, COUNT(*) AS n
     FROM messages m
     WHERE m.school_id = ? AND m.channel LIKE 'dm:%'
       AND (m.user_id = ? OR m.channel = 'dm:' || ?)
     GROUP BY m.channel`,
    schoolId, userId, userId
  );
}

/* brewed docs */

function addBrewDoc(userId, title, body, src) {
  const info = run(
    'INSERT INTO brewed_docs (user_id, title, body, src) VALUES (?, ?, ?, ?)',
    userId, title, body, src
  );
  return get('SELECT * FROM brewed_docs WHERE id = ?', info.lastInsertRowid);
}

function listBrewDocs(userId) {
  return all('SELECT * FROM brewed_docs WHERE user_id = ? ORDER BY id DESC', userId);
}

/* cheat sheets */

function addCheatSheet(userId, topic, content) {
  const info = run(
    'INSERT INTO cheat_sheets (user_id, topic, content) VALUES (?, ?, ?)',
    userId, topic, content
  );
  return get('SELECT * FROM cheat_sheets WHERE id = ?', info.lastInsertRowid);
}

function listCheatSheets(userId) {
  return all('SELECT * FROM cheat_sheets WHERE user_id = ? ORDER BY id DESC', userId);
}

module.exports = {
  db,
  get,
  run,
  all,
  findSchoolByName,
  listSchools,
  upsertUser,
  findUserByEmail,
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
  addBrewDoc,
  listBrewDocs,
  addCheatSheet,
  listCheatSheets
};