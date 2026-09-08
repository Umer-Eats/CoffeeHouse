/* CoffeeHouse — backend server (Vercel-compatible).
   Express + libSQL/Turso + Firebase Auth (Google sign-in) + Gemini/NotebookLM AI. */
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

const app = express();
app.use(express.json({ limit: '2mb' }));
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
  const defaultCred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  try {
    if (saPath && fs.existsSync(saPath)) {
      firebaseAuth = getAuth(initializeApp({ credential: cert(require(saPath)) }));
    } else if (saRaw) {
      firebaseAuth = getAuth(initializeApp({ credential: cert(JSON.parse(saRaw)) }));
    } else if (defaultCred) {
      firebaseAuth = getAuth(initializeApp());
    }
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
    firebaseAuth = null;
  }
}
initFirebase();

/* ---------------- channel / class structure (applies to every school) ---------------- */

const CLASSES = [
  { code: 'BIO-301', name: 'AP Biology', channels: [
      { slug: 'general', title: 'General' },
      { slug: 'hw-help', title: 'Homework help' },
      { slug: 'exam-prep', title: 'Exam prep' },
      { slug: 'lab-notes', title: 'Lab notes' }
  ]},
  { code: 'CALC-210', name: 'Calculus II', channels: [
      { slug: 'general', title: 'General' },
      { slug: 'hw-help', title: 'Homework help' },
      { slug: 'deriv-drills', title: 'Derivative drills' }
  ]},
  { code: 'ENG-105', name: 'English Lit', channels: [
      { slug: 'general', title: 'General' },
      { slug: 'discussion', title: 'Discussion' },
      { slug: 'essay-clinic', title: 'Essay clinic' }
  ]},
  { code: 'CS-110', name: 'Programming', channels: [
      { slug: 'general', title: 'General' },
      { slug: 'debug-squad', title: 'Debug squad' },
      { slug: 'project-z', title: 'Project Z' }
  ]}
];

const GROUP_TEMPLATES = [
  { name: 'Mitosis Masterminds', meta: 'BIO-301 · study group' },
  { name: 'Team Sigma', meta: 'CALC-210 · study group' },
  { name: 'Project Z', meta: 'CS-110 · study group' }
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
    time: m.created_at
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
  const fb = firebaseWebConfig && firebaseWebConfig.apiKey && firebaseAuth;
  res.json({
    firebaseConfigured: !!fb,
    firebase: fb ? firebaseWebConfig : null,
    geminiConfigured: !!ai.genAI,
    notebooklmEnabled: ai.notebooklmEnabled(),
    devLogin: DEV_LOGIN
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
    console.error('Firebase verify failed:', err.message);
    res.status(401).json({ error: 'Invalid Firebase token.' });
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
  const schoolId = Number((req.body || {}).schoolId);
  const school = await db.get('SELECT * FROM schools WHERE id = ?', schoolId);
  if (!school) return res.status(400).json({ error: 'Unknown school.' });
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

const BOT_ALIASES = {
  '@baristi': { email: 'baristi@coffeehouse.ai', handler: (q) => ai.baristaReply(q) },
  '@brewer':  { email: 'brewer@coffeehouse.ai',  handler: () => Promise.reject(new Error('brewer handled inline')) }
};

app.get('/api/messages', requireAuth, requireSchool, async (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ error: 'channel is required.' });
  if (!channel.startsWith('channel:') && !channel.startsWith('dm:')) {
    return res.status(400).json({ error: 'bad channel' });
  }
  const messages = await db.channelMessages(req.school.id, channel);
  res.json(messages.map(m => publicMessage(m, req.user.id)));
});

app.post('/api/messages', requireAuth, requireSchool, async (req, res) => {
  const { channel, text } = req.body || {};
  if (!channel || !text) return res.status(400).json({ error: 'channel and text are required.' });
  if (!channel.startsWith('channel:') && !channel.startsWith('dm:')) {
    return res.status(400).json({ error: 'unknown channel type' });
  }
  const msg = await db.insertMessage(req.school.id, channel, req.user.id, String(text).slice(0, 4000));
  res.json(publicMessage(msg, req.user.id));

  /* fire the AI sidekicks when summoned */
  for (const [alias, cfg] of Object.entries(BOT_ALIASES)) {
    if (new RegExp(alias, 'i').test(text)) {
      const bot = await db.findBotByEmail(cfg.email);
      if (!bot) continue;
      setTimeout(() => {
        (async () => {
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
            await db.insertMessage(req.school.id, channel, bot.id, full.slice(0, 4000));
          } catch (err) {
            console.error('Bot reply failed:', err.message);
            await db.insertMessage(req.school.id, channel, bot.id,
              `${alias} I couldn't brew that right now — ${err.message}`);
          }
        })();
      }, 600);
      break;
    }
  }
});

app.get('/api/dms', requireAuth, requireSchool, async (req, res) => {
  const threads = await db.dmThreads(req.user.id, req.school.id);
  const out = [];
  for (const t of threads) {
    const partnerId = Number(t.channel.split(':')[1]);
    const partner = await db.getUser(partnerId);
    const last = await db.get(
      `SELECT * FROM messages WHERE school_id = ? AND channel = ? ORDER BY id DESC LIMIT 1`,
      req.school.id, t.channel
    );
    if (partner) {
      out.push({
        partner: publicUser(partner),
        channel: t.channel,
        n: t.n,
        lastPreview: last ? last.text.slice(0, 40) : ''
      });
    }
  }
  out.sort((a, b) => b.n - a.n);
  res.json(out);
});

/* ---------------- project groups ---------------- */

app.get('/api/groups', requireAuth, requireSchool, async (req, res) => {
  const students = await db.schoolStudents(req.school.id, req.user.id);
  const groups = GROUP_TEMPLATES.map((g, i) => {
    const picked = [];
    for (let j = 0; j < students.length && picked.length < 4; j++) {
      const st = students[(i + j) % students.length];
      if (st.on || picked.length < 3) picked.push(st);
    }
    return { name: g.name, meta: g.meta, members: picked.map(s => ({ name: s.name, id: s.id })) };
  });
  res.json(groups);
});

/* ---------------- AI assistants ---------------- */

app.post('/api/ai/baristi', requireAuth, async (req, res) => {
  const text = ((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'text is required.' });
  try {
    const reply = await ai.baristaReply(text);
    res.json({ reply });
  } catch (err) {
    res.status(err.code === 'NO_KEY' ? 503 : 502).json({ error: err.message });
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
    const sheet = await db.addCheatSheet(req.user.id, String(topic).slice(0, 200), body);
    res.json({ id: sheet.id, topic: sheet.topic, content: body });
  } catch (err) {
    res.status(err.code === 'NO_KEY' ? 503 : 502).json({ error: err.message });
  }
});

app.get('/api/ai/baristi/cheats', requireAuth, async (req, res) => {
  res.json(await db.listCheatSheets(req.user.id));
});

app.post('/api/ai/brewer', requireAuth, async (req, res) => {
  const { source, text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'No source text to brew.' });
  try {
    const { doc, notebook, engine } = await ai.brewNotes(source || 'uploaded text', text);
    const stored = await db.addBrewDoc(req.user.id, `Brew — ${(source || 'text').slice(0, 60)}`, doc, source || null);
    res.json({ doc, id: stored.id, notebook, engine });
  } catch (err) {
    res.status(err.code === 'NO_KEY' ? 503 : 502).json({ error: err.message });
  }
});

app.get('/api/brewer/docs', requireAuth, async (req, res) => {
  res.json(await db.listBrewDocs(req.user.id));
});

/* ---------------- pages ---------------- */

async function guardPage(req, res, page) {
  await ensureDb();
  const user = await db.sessionUser(req.cookies[SESSION_COOKIE]);
  if (!user) return res.redirect('/');
  res.sendFile(path.join(__dirname, page));
}

app.get('/', async (req, res) => {
  await ensureDb();
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
    .replace('__DEV_LOGIN__', DEV_LOGIN ? 'block' : 'none');
  res.type('html').send(html);
});
app.get('/student.html', (req, res) => guardPage(req, res, 'student.html'));
app.get('/settings.html', (req, res) => guardPage(req, res, 'settings.html'));
app.get('/ai-assistant.html', (req, res) => guardPage(req, res, 'ai-assistant.html'));

app.use(express.static(__dirname));

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
      console.log('  Gemini (Baristi):', ai.genAI ? 'configured' : 'NOT configured (add GEMINI_API_KEY to .env)');
      console.log('  NotebookLM (Brewer):', ai.notebooklmEnabled() ? 'enterprise enabled' : 'gemini fallback');
    });
  }).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}
