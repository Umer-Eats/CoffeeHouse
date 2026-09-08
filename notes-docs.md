# CoffeeHouse — Notes & Documentation

CoffeeHouse is a warm little digital shop where students brew ideas, chat across
classes, and pour out project groups. This document covers setup, configuration,
and how each feature works. For a deep dive into the code layout, see
[`STRUCTURE.md`](STRUCTURE.md).

---

## 1. What the app does

- **Real student accounts** — students sign in with their Google account. There are
  no temporary/fake students anymore; every account is a real one, stored in SQLite.
- **School communities** — after logging in, each student joins exactly **one** school
  community from a dropdown. A student can change their community (or log out) from the
  **Settings** page.
  - Current communities:
    1. Pembroke Pines Charter High School
    2. American Heritage High School
    3. West Broward High School
- **Student hall** — class channels, direct messages, a student directory (sorted by
  the student's school), and project groups.
- **AI aides** — two bots that use real Google AI:
  - `@baristi` — explains anything, makes cheat sheets (Google **Gemini**).
  - `@brewer` — distills chat feeds / documents into clean study notes
    (NotebookLM-style, backed by **Gemini**, with optional **Gemini Notebook Enterprise**
    integration).

---

## 2. Prerequisites

- **Node.js 22.5+** (tested on Node 24). Get it at <https://nodejs.org>.
- A **Firebase** project (free tier is fine) for authentication.
- A **Gemini API key** (free) from <https://aistudio.google.com/app/apikey>.

---

## 3. Quick start

```bash
# 1. install dependencies
npm install

# 2. configure your keys
cp .env.example .env
#    then edit .env (FIREBASE_WEB_CONFIG, FIREBASE_SERVICE_ACCOUNT_PATH, GEMINI_API_KEY)

# 3. run it
npm start
```

Open <http://localhost:3000>. On Windows you can also double-click `start.bat`.

---

## 4. Configuration (`.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | Web server port (default `3000`) |
| `FIREBASE_WEB_CONFIG` | Web app config JSON from Firebase (apiKey, authDomain, projectId, appId…) — used by the browser to open the Google popup |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to the Firebase service-account JSON used by the Admin SDK to verify tokens |
| `FIREBASE_SERVICE_ACCOUNT` | Alternative: the raw service-account JSON inline |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternative: standard GCP env var the Admin SDK picks up |
| `GEMINI_API_KEY` | API key used by Baristi and Brewer (required for real AI) |
| `GEMINI_MODEL` | Gemini model, default `gemini-2.5-flash` |
| `NOTEBOOKLM_ENABLED` | `true` to also create real NotebookLM notebooks on each brew |
| `NOTEBOOKLM_PROJECT` | Google Cloud project number (NotebookLM Enterprise) |
| `NOTEBOOKLM_LOCATION` | `us`, `eu`, or `global` |
| `NOTEBOOKLM_ACCESS_TOKEN` | Bearer token, e.g. from `gcloud auth print-access-token` |
| `DEV_LOGIN` | `true` turns on a dev-only login box that creates real accounts without Firebase (for testing before configuring auth) |
| `COOKIE_SECURE` | `true` if serving over HTTPS |

### 4.1 Set up Firebase Sign-In (Google)

1. Go to <https://console.firebase.google.com> and **create a project** (or use an
   existing one).
2. Open **Authentication → Sign-in method** and enable **Google**.
3. Open **Authentication → Settings → Authorized domains** and add:
   - `localhost` and `http://localhost:3000` (dev)
   - your production domain later (e.g. `coffeehouse.example.com`)
4. In **Project settings → Your apps**, add a **Web app** (`</>`). Copy the web app
   config object and paste it into `FIREBASE_WEB_CONFIG` in `.env`:
   ```bash
   FIREBASE_WEB_CONFIG={"apiKey":"AIza...","authDomain":"coffeehouse.firebaseapp.com","projectId":"coffeehouse","storageBucket":"coffeehouse.appspot.com","messagingSenderId":"123...","appId":"1:123:web:abc"}
   ```
5. In **Project settings → Service accounts**, click **Generate new private key**
   (downloads a JSON file), then set:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_PATH=C:\path\to\coffeehouse-firebase-adminsdk-xxxx.json
   ```
6. Restart the server. The home page will now show the **SIGN IN WITH GOOGLE**
   button (a Firebase popup). The server prints `Firebase login: configured` at boot.

### 4.2 Set up Gemini (Baristi + Brewer)

1. Get an API key at <https://aistudio.google.com/app/apikey>.
2. Put it in `GEMINI_API_KEY`.
3. Restart. Baristi will now answer with real Gemini output, and Brewer will produce
   real study docs.

### 4.3 NotebookLM (Brewer) — optional

The consumer NotebookLM product has **no public API**. The Brewer bot therefore uses
Gemini for its NotebookLM-style, source-grounded study notes by default.

If your school has a **Gemini Notebook Enterprise** license, you can also make Brewer
create a *real* NotebookLM notebook and upload the source on every brew:

```bash
NOTEBOOKLM_ENABLED=true
NOTEBOOKLM_PROJECT=123456789012
NOTEBOOKLM_LOCATION=global
NOTEBOOKLM_ACCESS_TOKEN=$(gcloud auth print-access-token)
```

When enabled, the Brew card shows a link you can open in NotebookLM. If the notebook
API call fails for any reason, Brewer still returns the Gemini study doc (it never
blocks the app).

---

## 5. Feature guide

### Signing in
- Open the home page and press **SIGN IN WITH GOOGLE** (a Firebase popup opens).
- First-time students are asked to **join a school community** from a dropdown.
- Returning students go straight into their student hall.

### School communities
- A student belongs to **one** community at a time (enforced by the backend).
- **Change community / Log out**: open **Settings** from the student hall header.
- All chats are scoped to your current community, so switching schools moves you into
  that school's halls automatically.

### Student hall
- **Classes** tab: class channels (General, Homework help, Exam prep, …).
- **Direct msgs** tab: 1:1 chats with anyone in your school.
- **Find a student**: search box lists real students from your school only, with an
  online dot.
- **Project groups**: auto-generated study groups from your school's real members.
- Mention **@baristi** or **@brewer** in any message to summon the AI into the channel.

### AI assistants (`/ai-assistant.html`)
- **Baristi** tab: ask anything; requests containing "cheat sheet" also save a cheat
  sheet to the side rack.
- **Brewer** tab: paste text or load a channel, then hit **BREW NOTES** to get a study
  doc. Brewed docs are saved to your rack.

### Settings (`/settings.html`)
- See your Google profile.
- Change your school community (dropdown + **CHANGE COMMUNITY**).
- **LOG OUT** ends your session and returns you to the home page.

---

## 6. Data storage

Everything is stored in a SQLite database created automatically at
`data/coffeehouse.db` using Node's built-in `node:sqlite` module:

- `users` — real accounts (Firebase `uid`, email, name, picture). Two bot accounts
  (`Baristi AI`, `Brewer AI`) exist too.
- `schools` — the three member school communities.
- `memberships` — which student belongs to which school (one per student).
- `sessions` — opaque login tokens (7-day expiry), stored in an `HttpOnly` cookie.
- `messages` — chat messages scoped by school + channel.
- `brewed_docs`, `cheat_sheets` — saved AI outputs per student.
- `online` — heartbeat timestamps used to show the green online dot.

To reset everything, stop the server and delete `data/coffeehouse.db`; it is rebuilt
on next start (schools + bots are re-seeded).

---

## 7. Security notes

- Passwords are never stored — authentication is delegated entirely to Google via
  **Firebase Authentication**.
- Firebase ID tokens are verified server-side with the **Firebase Admin SDK**
  (`verifyIdToken`); the raw token is never trusted client-side.
- Session tokens are random, stored server-side, and sent in an `HttpOnly` cookie.
- The `FIREBASE_WEB_CONFIG` `apiKey` is exposed to the browser (it is public by
  design in Firebase). The service-account key, `GEMINI_API_KEY` and
  `NOTEBOOKLM_ACCESS_TOKEN` stay server-side only — never commit them.
- AI responses are generated server-side; never send secrets into chat prompts.
- `DEV_LOGIN` is a **development-only** convenience — disable it in production.

---

## 8. Known limitations

- NotebookLM's *consumer* product has no official API; the Brewer uses Gemini and,
  optionally, the gated Gemini Notebook Enterprise API (see §4.3).
- Messages are persisted per school/channel but there is no edit/delete or file
  upload yet.
- Online status is best-effort and based on a 30-second heartbeat.
- `DEV_LOGIN` accounts and real Firebase accounts are both "real" users in the DB; in
  production you may want to restrict which Google domains can log in.

---

## 9. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Home page says Firebase not configured | Add `FIREBASE_WEB_CONFIG` and `FIREBASE_SERVICE_ACCOUNT_PATH` to `.env` (see §4.1) |
| Google popup appears but login fails | Make sure **Google** is enabled in Authentication → Sign-in method, and your domain is in Authentication → Settings → Authorized domains |
| Login returns "Invalid Firebase token" | Check that the service account key matches the same Firebase project as the web config; restart the server |
| AI says "Gemini API key is not configured" | Add `GEMINI_API_KEY` to `.env` and restart |
| Bots reply with an error in chat | Usually the AI service is down or unconfigured; check the server console |