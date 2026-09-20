/* CoffeeHouse — backend server (Vercel-compatible).
   Express + libSQL/Turso + Firebase Auth (Google sign-in) + Gemini AI. */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cookieParser = require('cookie-parser');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const db = require('./db');
const ai = require('./ai');
const notes = require('./quick-notes').quickNotes(db);
const {moderateMessage} = require('./moderation');
const {validateAttachment}=require('./chat-attachment');
const {noteTitle} = require('./note-title');
const {validateImages, inputText} = require('./image-input');
const {resolveAttachments} = require('./blob-helpers');
const {generateClientTokenFromReadWriteToken} = require('@vercel/blob/client');

/* Read static JS at module scope so Vercel's nft bundles them */
const ART_JS = fs.readFileSync(path.join(__dirname, 'public', 'art.js'), 'utf8');
const APP_JS = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const STUDENT_HTML = fs.readFileSync(path.join(__dirname, 'public', 'student.html'), 'utf8');
const SETTINGS_HTML = fs.readFileSync(path.join(__dirname, 'public', 'settings.html'), 'utf8');
const AI_ASSISTANT_HTML = fs.readFileSync(path.join(__dirname, 'public', 'ai-assistant.html'), 'utf8');

const app = express();
app.use(express.json({ limit: '1mb' })); // Blob uploads keep payloads small; only URLs + text are sent
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({error:'Payload too large. Please try again.'});
  if (err.type === 'entity.parse.failed') return res.status(400).json({error:'The request could not be read. Please try again.'});
  next(err);
});
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_COOKIE = 'ch_session';

const DEV_LOGIN = String(process.env.DEV_LOGIN || '').toLowerCase() === 'true';

/* ---------------- lazy DB init (runs once per cold start) ---------------- */

let dbReady = null;
function ensureDb() {
  if (!dbReady) dbReady = db.init();
  return dbReady;
}

/* ---------------- Firebase Admin SDK ---------------- */

let firebaseAuth = null;
let firebaseWebConfig = null;

function initFirebase() {
  try { firebaseWebConfig = JSON.parse(process.env.FIREBASE_WEB_CONFIG || 'null'); } catch (e) {
    console.error('FIREBASE_WEB_CONFIG is invalid JSON:', e.message);
    firebaseWebConfig = null;
  }

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const saB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const defaultCred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  console.log('Firebase init — WEB_CONFIG:', !!firebaseWebConfig, 'SA:', !!saRaw, 'SA_B64:', !!saB64, 'PATH:', !!saPath, 'ADC:', !!defaultCred);
  try {
    let saJson = null;
    if (saPath && fs.existsSync(saPath)) {
      console.log('Firebase: using service account path');
      firebaseAuth = getAuth(initializeApp({ credential: cert(require(saPath)) }));
      return;
    } else if (saB64) {
      console.log('Firebase: decoding base64 service account');
      saJson = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
    } else if (saRaw) {
      console.log('Firebase: parsing service account JSON...');
      saJson = JSON.parse(saRaw);
    }
    if (saJson) {
      console.log('Firebase: SA parsed, client_email:', saJson.client_email);
      const app = initializeApp({ credential: cert(saJson) });
      console.log('Firebase: app initialized');
      firebaseAuth = getAuth(app);
      console.log('Firebase Admin: OK');
    } else if (defaultCred) {
      firebaseAuth = getAuth(initializeApp());
    }
  } catch (err) {
    console.error('Firebase Admin init FAILED:', err.message, err.stack);
    firebaseAuth = null;
  }
}
initFirebase();

/* ---------------- channel / class structure (applies to every school) ---------------- */

// Shared discussion rooms, not invented school course enrollments.
const CLASSES = [
  { code: 'HALL', name: 'School Community', channels: [
    { slug: 'general', title: 'General' },
    { slug: 'homework', title: 'Homework help' },
    { slug: 'study', title: 'Study together' }
  ]}
];

const channelKey = (code, slug) => `channel:${code}:${slug}`;

/* ---------------- helpers ---------------- */

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, picture: u.picture };
}

function publicMessage(m, meId) {
  return {
    id: m.id,
    channel: m.channel,
    text: m.text,
    author: m.author,
    author_id: m.user_id,
    picture: m.picture,
    bot: !!m.is_bot,
    me: m.user_id === meId,
    time: m.created_at || ''
  };
}

async function requireAuth(req, res, next) {
  await ensureDb();
  const user = await db.sessionUser(req.cookies[SESSION_COOKIE]);
  if (!user) return res.status(401).json({ error: 'not_authenticated' });
  req.user = user;
  next();
}

async function requireSchool(req, res, next) {
  const school = await db.getUserSchool(req.user.id);
  if (!school) return res.status(403).json({ error: 'no_school' });
  req.school = school;
  next();
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true',
    maxAge: SESSION_TTL_MS
  });
}

/* ---------------- config ---------------- */

app.get('/api/config', async (req, res) => {
  await ensureDb();
  const hasWebConfig = !!(firebaseWebConfig && firebaseWebConfig.apiKey);
  const hasAuth = !!firebaseAuth;
  const fb = hasWebConfig && hasAuth;
  res.json({
    firebaseConfigured: !!fb,
    firebase: fb ? firebaseWebConfig : null,
    baristaConfigured: ai.isConfigured(),
    brewerConfigured: ai.isConfigured(),
    devLogin: DEV_LOGIN,
    _debug: { hasWebConfig, hasAuth, envWebConfig: !!process.env.FIREBASE_WEB_CONFIG, envSA: !!process.env.FIREBASE_SERVICE_ACCOUNT }
  });
});

/* ---------------- auth ---------------- */

app.post('/api/auth/firebase', async (req, res) => {
  await ensureDb();
  const { idToken } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'Missing Firebase ID token.' });
  if (!firebaseAuth) {
    return res.status(503).json({
      error: 'Firebase is not configured yet. Add FIREBASE_WEB_CONFIG and a service account to .env (see notes-docs.md).'
    });
  }
  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    if (!decoded.email) return res.status(403).json({ error: 'This account has no email address.' });
    const allowed = decoded.email.endsWith('@pinescharter.net') || decoded.email === 'umerqure475@gmail.com';
    if (!allowed) return res.status(403).json({ error: 'Only Pines Charter accounts can sign in.' });
    const user = await db.upsertUser({
      sub: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email.split('@')[0],
      picture: decoded.picture || null
    });
    const token = await db.createSession(user.id, SESSION_TTL_MS);
    setSessionCookie(res, token);
    const school = await db.getUserSchool(user.id);
    res.json({ user: publicUser(user), school: school ? { id: school.id, name: school.name } : null });
  } catch (err) {
    console.error('Firebase verify failed:', err.message, err.code || '');
    res.status(401).json({ error: 'Sign-in failed: ' + err.message });
  }
});

/* Dev-only real-account login so you can try the app before configuring Firebase. */
app.post('/api/auth/dev', async (req, res) => {
  await ensureDb();
  if (!DEV_LOGIN) return res.status(404).json({ error: 'Dev login is disabled.' });
  const { email, name } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'A valid email is required.' });
  const displayName = (name || '').trim() || email.split('@')[0];
  const sub = 'dev-' + email;
  let user = await db.get('SELECT * FROM users WHERE firebase_uid = ?', sub);
  if (!user) {
    const info = await db.run('INSERT INTO users (firebase_uid, email, name) VALUES (?, ?, ?)', sub, email, displayName);
    user = await db.get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
  }
  const token = await db.createSession(user.id, SESSION_TTL_MS);
  setSessionCookie(res, token);
  const school = await db.getUserSchool(user.id);
  res.json({ user: publicUser(user), school: school ? { id: school.id, name: school.name } : null });
});

app.post('/api/logout', async (req, res) => {
  await ensureDb();
  await db.destroySession(req.cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.put('/api/me/display-name', requireAuth, async (req, res) => {
  const name=typeof req.body?.name==='string'?req.body.name.trim().replace(/\s+/g,' '):'';
  if(!name||name.length>50||/[\u0000-\u001f\u007f]/.test(name))return res.status(400).json({error:'Enter a display name between 1 and 50 characters.'});
  try{
    await db.client.batch([
      {sql:'INSERT INTO user_display_names(user_id,name) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name',args:[req.user.id,name]},
      {sql:'UPDATE users SET name=? WHERE id=?',args:[name,req.user.id]}
    ],'write');
    res.json({name});
  }catch{res.status(500).json({error:'Could not save your display name. Please try again.'});}
});
app.get('/api/me', requireAuth, async (req, res) => {
  const school = await db.getUserSchool(req.user.id);
  res.json({ user: publicUser(req.user), school: school ? { id: school.id, name: school.name } : null });
});

/* ---------------- schools / communities ---------------- */

app.get('/api/schools', requireAuth, async (req, res) => {
  const schools = await db.listSchools();
  res.json(schools.map(s => ({ id: s.id, name: s.name })));
});

app.post('/api/school/join', requireAuth, async (req, res) => {
  const { schoolId, password } = req.body || {};
  const id = Number(schoolId);
  const school = await db.get('SELECT * FROM schools WHERE id = ?', id);
  if (!school) return res.status(400).json({ error: 'Unknown school.' });
  if (password !== 'iluvmatcha') return res.status(403).json({ error: 'Incorrect community password.' });
  await db.setUserSchool(req.user.id, school.id);
  res.json({ school: { id: school.id, name: school.name } });
});

/* ---------------- students (real accounts, sorted by school) ---------------- */

app.get('/api/students', requireAuth, requireSchool, async (req, res) => {
  res.json(await db.schoolStudents(req.school.id, req.user.id));
});

app.post('/api/heartbeat', requireAuth, async (req, res) => {
  await db.heartbeat(req.user.id);
  res.json({ ok: true });
});

/* ---------------- channels ---------------- */

app.get('/api/channels', requireAuth, requireSchool, async (req, res) => {
  const row = await db.get('SELECT COUNT(*) AS n FROM memberships WHERE school_id = ?', req.school.id);
  const members = row.n;
  res.json({
    school: { id: req.school.id, name: req.school.name },
    members,
    classes: CLASSES.map(c => ({
      code: c.code,
      name: c.name,
      channels: c.channels.map(ch => ({ slug: ch.slug, title: ch.title, key: channelKey(c.code, ch.slug) }))
    }))
  });
});

/* ---------------- messages ---------------- */
app.get('/api/message-counts', requireAuth, requireSchool, async (req, res) => {
  try {
    const rows = await db.unreadCounts(req.user.id, req.school.id);
    const counts = {};
    for (const row of rows) {
      if (row.channel.startsWith('dm:')) {
        const school = await db.getUserSchool(Number(row.channel.slice(3)));
        if (school?.id !== req.school.id) continue;
      }
      counts[row.channel] = Number(row.n);
    }
    for (const group of await db.listPersonalGroups(req.user.id)) {
      const row=await db.get(`SELECT COUNT(*) AS n FROM messages WHERE school_id=? AND channel=? AND user_id!=?
        AND id>COALESCE((SELECT last_id FROM message_reads WHERE user_id=? AND school_id=? AND channel=?),0)`,group.school_id,group.channel,req.user.id,req.user.id,group.school_id,group.channel);
      if(row.n) counts[group.channel]=Number(row.n);
    }
    res.json(counts);
  } catch { res.status(500).json({error:'Could not load message counts.'}); }
});

const BOT_ALIASES = {
  '@baristi': { email: 'baristi@coffeehouse.ai', handler: (q) => ai.baristaReply(q) },
  '@brewer':  { email: 'brewer@coffeehouse.ai',  handler: () => Promise.reject(new Error('brewer handled inline')) }
};

async function checkMessageChannel(req, res, next) {
  const channel = req.method === 'GET' ? req.query.channel : req.body?.channel;
  if (typeof channel !== 'string' || !/^(channel:.+|dm:[1-9]\d*)$/.test(channel)) return res.status(400).json({error:'Invalid conversation.'});
  if(channel.startsWith('channel:personal:')) {
    try {
      const group=await db.personalGroup(channel,req.user.id);
      if(!group)return res.status(404).json({error:'Conversation not found.'});
      req.school={...req.school,id:group.school_id};
    }catch{return res.status(500).json({error:'Could not open group.'});}
  } else if(channel.startsWith('channel:') && !CLASSES.some(c=>c.channels.some(ch=>channelKey(c.code,ch.slug)===channel))) {
    return res.status(404).json({error:'Conversation not found.'});
  }
  if (channel.startsWith('dm:')) {
    const id = Number(channel.slice(3));
    if (!Number.isSafeInteger(id) || id === req.user.id) return res.status(400).json({error:'Choose another student.'});
    try {
      const partner = await db.getUser(id);
      const school = partner && await db.getUserSchool(id);
      if (!partner || partner.is_bot || !school || school.id !== req.school.id) return res.status(403).json({error:'Choose a student in your school.'});
      req.dmPartner = id;
    } catch (err) { return res.status(500).json({error:'Could not open this conversation.'}); }
  }
  next();
}

app.post('/api/messages/read', requireAuth, requireSchool, checkMessageChannel, async (req, res) => {
  const {channel,lastId} = req.body;
  if (!Number.isSafeInteger(lastId) || lastId < 1) return res.status(400).json({error:'Invalid message.'});
  try {
    const row = await db.get('SELECT * FROM messages WHERE id = ? AND school_id = ?', lastId, req.school.id);
    const belongs = row && (req.dmPartner
      ? ((row.user_id === req.user.id && row.channel === channel) || (row.user_id === req.dmPartner && row.channel === 'dm:' + req.user.id))
      : row.channel === channel);
    if (!belongs) return res.status(404).json({error:'Message not found.'});
    await db.markMessagesRead(req.user.id, req.school.id, channel, lastId);
    res.json({ok:true});
  } catch { res.status(500).json({error:'Could not update read status.'}); }
});

app.get('/api/messages', requireAuth, requireSchool, checkMessageChannel, async (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ error: 'channel is required.' });
  if (!channel.startsWith('channel:') && !channel.startsWith('dm:')) {
    return res.status(400).json({ error: 'bad channel' });
  }
  const messages = req.dmPartner
    ? await db.directMessages(req.school.id, req.user.id, req.dmPartner)
    : await db.channelMessages(req.school.id, channel);
  const out = [];
  const files = messages.length ? await db.all('SELECT message_id,name,mime_type FROM message_attachments WHERE message_id IN ('+messages.map(()=>'?').join(',')+')',...messages.map(m=>m.id)) : [];
  const byMessage = new Map(files.map(file=>[file.message_id,file]));
  for (const m of messages) {
    const attachment = byMessage.get(m.id);
    out.push({...publicMessage(m,req.user.id),attachment:attachment ? {name:attachment.name,mimeType:attachment.mime_type,url:'/api/attachments/'+m.id} : null});
  }
  res.json(out);
});

app.get('/api/attachments/:id',requireAuth,requireSchool,async(req,res)=>{
  const row=await db.get('SELECT m.school_id,m.channel,m.user_id,a.* FROM message_attachments a JOIN messages m ON m.id=a.message_id WHERE m.id=?',req.params.id);
  if(!row)return res.status(404).json({error:'File not found.'});
  if(row.channel.startsWith('channel:personal:')) {
    if(!await db.personalGroup(row.channel,req.user.id))return res.status(404).json({error:'File not found.'});
  }else if(row.school_id!==req.school.id || (row.channel.startsWith('dm:') && row.user_id!==req.user.id && row.channel!=='dm:'+req.user.id)) return res.status(404).json({error:'File not found.'});
  res.set('Cache-Control','private, no-store');
  res.set('X-Content-Type-Options','nosniff');
  res.set('Content-Security-Policy',"sandbox; default-src 'none'");
  res.set('Content-Disposition',(row.mime_type==='application/pdf'?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(row.name));
  res.type(row.mime_type).send(Buffer.from(row.data,'base64'));
});

app.get('/api/ai/pending', requireAuth, requireSchool, checkMessageChannel, async (req, res) => {
  if (req.dmPartner) return res.json([]);
  try {
    res.json(await db.all("SELECT DISTINCT kind FROM ai_pending WHERE school_id = ? AND channel = ? AND started_at > datetime('now','-2 minutes')", req.school.id, req.query.channel));
  } catch { res.status(500).json({error:'Could not load AI activity.'}); }
});

app.post('/api/messages', requireAuth, requireSchool, checkMessageChannel, async (req, res) => {
  const { channel, text } = req.body || {};
  let attachment;
  try { attachment=validateAttachment(req.body?.attachment); } catch(err) {return res.status(400).json({error:err.message});}
  if (!channel || typeof text!=='string' || (!text.trim() && !attachment)) return res.status(400).json({ error: 'Add a message or file.' });
  if (text.length>4000) return res.status(400).json({error:'Messages must be 4,000 characters or fewer.'});
  if (!channel.startsWith('channel:') && !channel.startsWith('dm:')) {
    return res.status(400).json({ error: 'unknown channel type' });
  }
  try { await moderateMessage(channel,text,attachment); }
  catch (err) { return res.status(err.status || 503).json({error:err.message,code:err.code}); }
  const msg = await db.insertMessage(req.school.id, channel, req.user.id, text);
  if(attachment) await db.run('INSERT INTO message_attachments (message_id,name,mime_type,data) VALUES (?,?,?,?)',msg.id,attachment.name,attachment.mimeType,attachment.data);
  if (req.dmPartner) return res.json(publicMessage(msg, req.user.id));

  /* fire the AI sidekicks when summoned */
  for (const [alias, cfg] of Object.entries(BOT_ALIASES)) {
    if (new RegExp(alias === '@baristi' ? '@barist[ai]\\b' : '@brewer\\b', 'i').test(text)) {
      const bot = await db.findBotByEmail(cfg.email);
      if (!bot) continue;
      await db.run('INSERT INTO ai_pending (message_id, school_id, channel, kind) VALUES (?, ?, ?, ?)', msg.id, req.school.id, channel, alias === '@brewer' ? 'brewer' : 'barista');
      // Keep the serverless request alive until the reply has been persisted.
          try {
            let reply;
            if (alias === '@brewer') {
              const feedRows = await db.channelMessages(req.school.id, channel, 40);
              const feed = feedRows.map(m => `${m.author}: ${m.text}`).join('\n');
              const { doc } = await ai.brewNotes(channel, feed);
              reply = doc;
            } else {
              reply = await cfg.handler(text);
            }
            const full = `${alias} ${reply}`;
            await moderateMessage(channel,full.slice(0,4000));
            await db.insertMessage(req.school.id, channel, bot.id, full.slice(0, 4000));
          } catch (err) {
            console.error('Bot reply failed:', err.message);
            await db.insertMessage(req.school.id, channel, bot.id,
              `${alias} I couldn't finish that response. The AI service may be busy or unavailable. Please try mentioning me again in a moment.`);
          } finally {
            await db.run('DELETE FROM ai_pending WHERE message_id = ?', msg.id);
          }
      break;
    }
  }
  res.json(publicMessage(msg, req.user.id));
});

app.get('/api/dms', requireAuth, requireSchool, async (req, res) => {
  const threads = await db.dmThreads(req.user.id, req.school.id);
  const out = [];
  for (const t of threads) {
    const partnerId = Number(t.partner_id);
    const partner = await db.getUser(partnerId);
    const partnerSchool = partner && await db.getUserSchool(partnerId);
    const last = await db.get(
      `SELECT * FROM messages WHERE school_id = ? AND id = ?`,
      req.school.id, t.last_id
    );
    if (partner && !partner.is_bot && partnerSchool?.id === req.school.id) {
      out.push({
        partner: publicUser(partner),
        channel: 'dm:' + partnerId,
        n: t.n,
        lastPreview: last ? last.text.slice(0, 40) : ''
      });
    }
  }
  res.json(out);
});

/* ---------------- project groups ---------------- */

app.get('/api/groups', requireAuth, requireSchool, async (req, res) => {
  res.json(await db.listPersonalGroups(req.user.id));
});
app.get('/api/groups/students',requireAuth,requireSchool,async(req,res)=>{
  const query=typeof req.query.q==='string'?req.query.q.slice(0,100):'';
  const after=Math.max(0,Number(req.query.after)||0);
  const students=await db.all('SELECT id,name FROM users WHERE is_bot=0 AND id!=? AND id>? AND instr(lower(name),lower(?))>0 ORDER BY id LIMIT 101',req.user.id,after,query);
  res.json({students:students.slice(0,100),more:students.length>100});
});
app.post('/api/groups',requireAuth,requireSchool,async(req,res)=>{
  const {name,memberIds}=req.body||{};
  if(typeof name!=='string'||!Array.isArray(memberIds))return res.status(400).json({error:'Choose students and a group name.'});
  try{res.status(201).json(await db.createPersonalGroup(req.user.id,req.school.id,name.trim(),memberIds));}
  catch(err){res.status(err.status||500).json({error:err.status?err.message:'Could not create group. Please try again.'});}
});
app.get('/api/groups/:id/members',requireAuth,requireSchool,async(req,res)=>{
  try{
    const group=await db.personalGroup('channel:personal:'+req.params.id,req.user.id);
    if(!group)return res.status(404).json({error:'Group not found.'});
    res.json(await db.all('SELECT u.id,u.name FROM users u JOIN personal_group_members m ON m.user_id=u.id WHERE m.group_id=? ORDER BY u.name',group.id));
  }catch{res.status(500).json({error:'Could not load members.'});}
});
app.put('/api/groups/:id/members',requireAuth,requireSchool,async(req,res)=>{
  if(!Array.isArray(req.body?.memberIds))return res.status(400).json({error:'Choose members.'});
  try{res.json(await db.updateGroupMembers(req.user.id,req.params.id,req.body.memberIds));}
  catch(err){res.status(err.status||500).json({error:err.status?err.message:'Could not save members.'});}
});
app.delete('/api/groups/:id',requireAuth,requireSchool,async(req,res)=>{
  try{await db.deletePersonalGroup(req.user.id,req.params.id);res.json({ok:true});}
  catch(err){res.status(err.status||500).json({error:err.status?err.message:'Could not delete group. Please try again.'});}
});
app.post('/api/groups/:id/leave',requireAuth,requireSchool,async(req,res)=>{
  try{await db.leavePersonalGroup(req.user.id,req.params.id);res.json({ok:true});}
  catch(err){res.status(err.status||500).json({error:err.status?err.message:'Could not leave group. Please try again.'});}
});

/* ---------------- Vercel Blob client-direct uploads ---------------- */

app.post('/api/blob/upload', requireAuth, async (req, res) => {
  try {
    const { type, payload } = req.body || {};
    if (type !== 'blob.generate-client-token') {
      return res.status(400).json({ error: 'Invalid upload event type.' });
    }
    const { pathname } = payload || {};
    if (!pathname) return res.status(400).json({ error: 'Missing pathname.' });
    const ext = (pathname.split('.').pop() || '').toLowerCase();
    const allowed = ['jpg','jpeg','png','webp','gif','pdf'];
    if (!allowed.includes(ext)) return res.status(400).json({ error: 'File type not allowed.' });
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      maximumSizeInBytes: 50 * 1024 * 1024,
      allowedContentTypes: ['image/jpeg','image/png','image/webp','image/gif','application/pdf'],
    });
    res.json({ clientToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- AI assistants ---------------- */

app.post('/api/ai/baristi', requireAuth, async (req, res) => {
  try {
    const text = inputText(req.body?.text, 12000, 'Question');
    const images = await resolveAttachments(req.body?.images);
    if (!text && !images.length) return res.status(400).json({error:'Add a question or an image.'});
    const reply = await ai.baristaReply(text, images);
    res.json({ reply });
  } catch (err) {
    res.status(err.status || (err.code === 'NO_KEY' ? 503 : 502)).json({ error: err.message });
  }
});

app.post('/api/ai/baristi/cheats', requireAuth, async (req, res) => {
  const { topic, content } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'topic is required.' });
  try {
    let body = String(content || '');
    if (!body) {
      body = await ai.baristaCheatSheet(topic);
    }
    const sheet = await db.addCheatSheet(req.user.id, noteTitle(body, topic), body);
    res.json({ id: sheet.id, topic: sheet.topic, content: body });
  } catch (err) {
    res.status(err.code === 'NO_KEY' ? 503 : 502).json({ error: err.message });
  }
});

app.get('/api/ai/baristi/cheats', requireAuth, async (req, res) => {
  res.json((await db.listCheatSheets(req.user.id)).map(sheet => ({...sheet,topic:noteTitle(sheet.content,sheet.topic)})));
});

app.post('/api/ai/brewer', requireAuth, async (req, res) => {
  try {
    const source = inputText(req.body?.source, 200, 'Source name');
    const text = inputText(req.body?.text, 60000, 'Source text');
    const images = await resolveAttachments(req.body?.images);
    if (!text && !images.length) return res.status(400).json({error:'Add source text or an image to brew notes.'});
    const label = source || (images.length ? 'Attached images' : 'Pasted text');
    const { doc, engine } = await ai.brewNotes(label, text, images);
    const stored = await db.addBrewDoc(req.user.id, noteTitle(doc, label), doc, label);
    res.json({ doc, id: stored.id, title:stored.title, engine });
  } catch (err) {
    res.status(err.status || (err.code === 'NO_KEY' ? 503 : 502)).json({ error: err.message });
  }
});

app.get('/api/brewer/docs', requireAuth, async (req, res) => {
  res.json((await db.listBrewDocs(req.user.id)).map(doc => ({...doc,title:noteTitle(doc.body,doc.title)})));
});

/* ---------------- pages ---------------- */
app.get('/api/notes',requireAuth,async(req,res)=>{
  try{res.json(await notes.list(req.user.id));}catch{res.status(500).json({error:'Could not load your notes. Please retry.'});}
});
app.post('/api/notes',requireAuth,async(req,res)=>{
  try{res.status(201).json(await notes.create(req.user.id));}catch{res.status(500).json({error:'Could not create a note. Please retry.'});}
});
app.put('/api/notes/:id',requireAuth,async(req,res)=>{
  try{res.json(await notes.save(req.user.id,req.params.id,req.body));}catch(err){res.status(err.status||500).json({error:err.status?err.message:'Could not save your note. Please retry.'});}
});
app.delete('/api/notes/:id',requireAuth,async(req,res)=>{
  try{await notes.remove(req.user.id,req.params.id);res.json({ok:true});}catch{res.status(500).json({error:'Could not delete your note. Please retry.'});}
});
for (const [route, remove] of [
  ['/api/brewer/docs/:id', db.deleteBrewDoc],
  ['/api/ai/baristi/cheats/:id', db.deleteCheatSheet]
]) {
  app.delete(route, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({error:'Invalid saved item.'});
    try {
      await remove(req.user.id, id);
      res.json({ok:true});
    } catch (err) {
      res.status(500).json({error:'Could not delete this item. Please try again.'});
    }
  });
}

async function guardPage(req, res, page) {
  await ensureDb();
  const user = await db.sessionUser(req.cookies[SESSION_COOKIE]);
  if (!user) return res.redirect('/');
  res.type('html').send(page);
}

app.get('/', async (req, res) => {
  await ensureDb();
  const html = INDEX_HTML.replace('__DEV_LOGIN__', DEV_LOGIN ? 'block' : 'none');
  res.type('html').send(html);
});
app.get('/student.html', (req, res) => guardPage(req, res, STUDENT_HTML));
app.get('/settings.html', (req, res) => guardPage(req, res, SETTINGS_HTML));
app.get('/ai-assistant.html', (req, res) => guardPage(req, res, AI_ASSISTANT_HTML));

app.get('/art.js', (req, res) => res.type('application/javascript').send(ART_JS));
app.get('/app.js', (req, res) => res.type('application/javascript').send(APP_JS));

app.use(express.static(path.join(__dirname, 'public')));
// Serve pinned local rendering libraries and KaTeX fonts; no CDN dependency.
app.use('/vendor/katex', express.static(path.join(__dirname, 'node_modules/katex/dist')));
app.use('/vendor/markdown-it', express.static(path.join(__dirname, 'node_modules/markdown-it/dist')));

/* ---------------- export for Vercel serverless / start locally ---------------- */

if (process.env.VERCEL) {
  // Vercel: export the app (no listen)
  module.exports = app;
} else {
  // Local / other hosts: start the server
  ensureDb().then(() => {
    app.listen(PORT, () => {
      console.log(`\u2615 CoffeeHouse server running at http://localhost:${PORT}`);
      console.log('  Firebase login:', firebaseAuth ? 'configured' : 'NOT configured (see notes-docs.md)');
      console.log('  Baristi (Gemini):', ai.isConfigured() ? 'configured' : 'NOT configured (add BARISTA_API_KEY to .env)');
      console.log('  Brewer (Gemini):', ai.isConfigured() ? 'configured' : 'NOT configured (add BREWER_API_KEY to .env)');
    });
  }).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}
