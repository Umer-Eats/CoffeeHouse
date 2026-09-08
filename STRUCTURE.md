# CoffeeHouse — Application Structure

This document explains the entire structure of CoffeeHouse: where the backend lives,
where the frontend lives, and how data flows between them.

```
                        ┌──────────────────────────────────────────┐
   BROWSER (FRONTEND)   │  index.html · student.html · settings.html │
   index.html           │  ai-assistant.html · app.js · art.js       │
        │               └──────────────┬───────────────────────────┘
        │  fetch("/api/...")           │  (same-origin, HttpOnly cookie)
        ▼                              ▼
                        ┌──────────────────────────────────────────┐
   EXPRESS (BACKEND)    │  server.js  ← routes + auth + guards      │
                        │  db.js      ← SQLite (node:sqlite)        │
                        │  ai.js      ← Google Gemini + NotebookLM  │
                        │  data/coffeehouse.db                      │
                        └──────────────────────────────────────────┘
```

---

## 1. Project layout

```
CoffeeHouse/
├── server.js            # Backend: Express app, all API routes, auth middleware
├── db.js                # Backend: database layer (SQLite via node:sqlite)
├── ai.js                # Backend: Google Gemini + NotebookLM integrations
├── package.json         # Backend: dependencies + npm scripts
├── .env / .env.example  # Backend: configuration (see notes-docs.md §4)
├── data/                # Created at runtime — stores coffeehouse.db
│
├── index.html           # Frontend: landing page + Google sign-in + school picker
├── student.html         # Frontend: student hall (channels, DMs, directory)
├── settings.html        # Frontend: profile, change school, log out
├── ai-assistant.html    # Frontend: Baristi + Brewer AI workspace
├── app.js               # Frontend: shared helpers (api(), esc(), avatars, time)
├── art.js               # Frontend: pixel-art canvas engine + day/night theme
│
├── notes-docs.md        # Documentation: setup, config, usage, security
├── STRUCTURE.md         # This file — how the whole app is wired together
└── start.bat            # Windows double-click launcher
```

---

## 2. Backend (server-side)

### 2.1 `server.js` — HTTP layer

Express serves both the HTML pages and the JSON API. Static files (`.html`, `.js`,
`.css`) are served from the project root.

**Page routes (with auth guard):**

| Route | Auth | Purpose |
| --- | --- | --- |
| `/` | none | Landing page + sign-in |
| `/student.html` | required | Student hall (redirects to `/` if logged out) |
| `/settings.html` | required | Settings (redirects to `/` if logged out) |
| `/ai-assistant.html` | required | AI workspace (redirects to `/` if logged out) |

**API routes:**

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/config` | none | Tells the client what is configured (Firebase, Gemini, NotebookLM) |
| `POST /api/auth/firebase` | none | Verifies a Firebase ID token (`verifyIdToken`) and starts a session |
| `POST /api/auth/dev` | none | Dev-only real-account login (`DEV_LOGIN=true`) |
| `POST /api/logout` | session | Ends the session, clears cookie |
| `GET /api/me` | session | Current user + their school community |
| `GET /api/schools` | session | List of all school communities |
| `POST /api/school/join` | session | Join / change school community (replaces previous) |
| `GET /api/students` | session + school | Real students in *my* school, sorted by name |
| `POST /api/heartbeat` | session | Marks me online (green dot) |
| `GET /api/channels` | session + school | Class channels for my school + member count |
| `GET /api/messages?channel=` | session + school | Messages for a channel in my school |
| `POST /api/messages` | session + school | Post a message; triggers `@baristi`/`@brewer` |
| `GET /api/dms` | session + school | My 1:1 conversation threads |
| `GET /api/groups` | session + school | Project groups built from real school members |
| `POST /api/ai/baristi` | session | Ask Baristi (Gemini) and get a reply |
| `POST /api/ai/baristi/cheats` | session | Generate & save a cheat sheet |
| `GET /api/ai/baristi/cheats` | session | My saved cheat sheets |
| `POST /api/ai/brewer` | session | Brew study notes from source text |
| `GET /api/brewer/docs` | session | My brewed documents |

**Middleware chain:** `cookieParser` → `requireAuth` (looks up `ch_session` token in
the DB) → `requireSchool` (checks the user has joined exactly one community).

### 2.2 `db.js` — data layer

Uses Node's built-in **SQLite** (`node:sqlite`, `DatabaseSync`). Schema is created
automatically on first run and seeded with the three schools and the two AI bot
accounts. Key queries:

- `upsertUser()` — creates or updates a real account from a Firebase profile.
- `setUserSchool()` — deletes any previous membership, then inserts the new one
  (this is what enforces **one community per student**).
- `schoolStudents()` — returns students whose `memberships.school_id` matches mine,
  excluding bots and myself, with online status.
- `channelMessages()` / `insertMessage()` — message storage scoped by
  `school_id + channel`.
- `createSession()` / `sessionUser()` — opaque 7-day session tokens.

### 2.3 `ai.js` — AI layer

- **Baristi** → Google **Gemini** (`@google/generative-ai`) with a study-tutor system
  prompt.
- **Brewer** → source-grounded study notes. By default it uses Gemini. When
  `NOTEBOOKLM_ENABLED=true` it also calls the **Gemini Notebook Enterprise** REST API
  to create a real NotebookLM notebook and upload the source as text.

If `GEMINI_API_KEY` is missing, calls fail with a friendly error instead of crashing.

### 2.4 How a bot reply happens in chat

1. Student posts `@baristi explain mitosis` → `POST /api/messages`.
2. Server inserts the student's message and replies 200 immediately.
3. Server matches `@baristi` and runs `ai.baristaReply(...)` in the background.
4. When Gemini responds, the bot's message is inserted into the same channel.
5. The student's page polls `/api/messages` every ~3.5 s and renders the new reply.

---

## 3. Frontend (browser)

### 3.1 `index.html` — entry & sign-in

- Loads the **Firebase Web SDK** (compat) from `www.gstatic.com/firebasejs/10.12.2`
  (`firebase-app-compat.js` + `firebase-auth-compat.js`).
- When `GET /api/config` reports Firebase is configured, initializes
  `firebase.initializeApp(CFG.firebase)` and shows a custom **SIGN IN WITH GOOGLE**
  button.
- `signInWithGoogle` calls `firebase.auth().signInWithPopup(GoogleAuthProvider)`,
  gets the ID token with `user.getIdToken()`, and sends it to
  `POST /api/auth/firebase`; the server responds with `{ user, school }`.
- If the student has **no school yet**, a modal opens with a **dropdown of school
  communities** (the three schools). Selecting one calls
  `POST /api/school/join` and redirects to the student hall.
- A dev login box appears when `DEV_LOGIN=true`.

### 3.2 `student.html` — the student hall

- On load: `GET /api/me` (redirects to `/` if not signed in), then fetches channels,
  students, DMs and groups in parallel.
- Left rail: **Classes** tab (channels per class) and **Direct msgs** tab (1:1 threads).
- Center: chat window; messages are re-fetched on a 3.5 s poll so bot replies and
  classmates' messages appear live. A 30 s heartbeat keeps the green dot lit.
- Right rail: **Find a student** (filters `GET /api/students`, which only ever returns
  students in my school) and **Project groups**.
- Header shows the signed-in student's real Google name/email/school/picture and links
  to **Settings** and **AI Aides**.

### 3.3 `settings.html` — profile, community, logout

- Shows the Google profile.
- **Change community**: dropdown of all schools → `POST /api/school/join`. The backend
  atomically replaces the membership, so the student is re-sorted into the new school.
- **Log out**: `POST /api/logout` → cookie cleared → redirect to `/`.

### 3.4 `ai-assistant.html` — the AI workspace

- **Baristi tab**: messages → `POST /api/ai/baristi` → real Gemini reply. "cheat sheet"
  requests also call `POST /api/ai/baristi/cheats` and show up in the side rack.
- **Brewer tab**: paste text or load a channel (fetch its messages client-side) →
  `POST /api/ai/brewer` → a study doc card, plus the NotebookLM link if enterprise is
  enabled. Brewed docs persist per student (`GET /api/brewer/docs`).

### 3.5 Shared frontend code

- `app.js` — `api()` wrapper (fetch + cookies + JSON errors), escaping, initials,
  deterministic avatar colors, time formatting.
- `art.js` — the pixel-art canvas engine and the day/night theme toggle shared by all
  pages.

---

## 4. Data model (SQLite)

```
users       (id, firebase_uid UNIQUE, email UNIQUE, name, picture, is_bot)
schools     (id, name UNIQUE)                    ← 3 seeded communities
memberships (user_id, school_id)  PK(user, school) ← one row per student = one community
sessions    (token PK, user_id, expires_at)
messages    (id, school_id, channel, user_id, text, created_at)
brewed_docs (id, user_id, title, body, src, created_at)
cheat_sheets(id, user_id, topic, content, created_at)
online      (user_id PK, last_seen)
```

Channel keys: class channels are `channel:CODE:SLUG` (e.g. `channel:BIO-301:general`);
direct messages are `dm:<user-id>`.

---

## 5. Two end-to-end flows

### Logging in and joining a school

```
Google button → Firebase popup (browser)
  → user.getIdToken() → POST /api/auth/firebase
      → server verifyIdToken() with Firebase Admin SDK (firebase-admin)
      → upsertUser() creates/updates the real account (firebase_uid)
      → createSession() sets HttpOnly cookie
  → { user, school:null }
→ school picker modal (frontend)
  → POST /api/school/join { schoolId }
      → setUserSchool() replaces any old membership
  → redirect /student.html
```

### Chatting and summoning the AI

```
POST /api/messages { channel, text }
  → insertMessage() stored under my school_id
  → server fires @baristi/@brewer handler in background
  → poll GET /api/messages?channel=... picks up bot reply → renders
```

---

## 6. Configuration summary

Everything is driven by `.env` (template: `.env.example`). Keys that change behaviour
are documented in [`notes-docs.md`](notes-docs.md) §4.