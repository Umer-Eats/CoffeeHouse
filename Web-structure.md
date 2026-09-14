# CoffeeHouse application structure

## Purpose

CoffeeHouse combines school communication with AI-assisted study in a cozy pixel-art café. Students discover the product without signing in, then use a Google account to choose their school and enter Student Hall. Baristi explains questions and produces cheat sheets; Brewer organizes supplied text into study notes.

This document describes the implemented application, not a roadmap. There is no working event calendar, persistent project-group system, school enrollment verification, or file-upload integration.

## Page map

| Route | Access | Purpose |
| --- | --- | --- |
| / | Public | Café home, navigation, sign-in |
| /chat.html | Public | Explains school rooms, student discovery, and messaging |
| /study.html | Public | Explains Baristi, Brewer, and saved study materials |
| /profile.html | Public | Explains identity, school membership, and appearance |
| /student.html | Session required | School rooms, messages, student directory |
| /ai-assistant.html | Session required | Baristi questions, Brewer sources, saved materials |
| /settings.html | Session required | Google identity, school change, logout |

Public primary actions open the account dialog. Google login returns a CoffeeHouse session; a student with no school chooses one before entering Student Hall. Returning users use the account button to enter the hall. Public explanation links remain explanations after login.

## Files and serving

- `server.js`: Express routes, Firebase token verification, session cookies, school checks, messaging and AI endpoints.
- `db.js`: libSQL client; remote Turso when configured, local SQLite file otherwise.
- `ai.js`: Google Gemini requests through `@google/generative-ai`. Separate Baristi/Brewer keys and model settings.
- `client.js`: shared browser helpers served at `/app.js`; escaping, API requests, avatars, time formatting.
- `art.js`: decorative pixel canvas sprites and palette initialization.
- Root `index.html`, `student.html`, `settings.html`, `ai-assistant.html`: read by the server at startup. Restart the local server after editing these files.
- `public/`: static CSS, scripts, images, and the three explanation pages. Root HTML copies are mirrored here for consistency. Tests detect drift.
- `public/home.js`: public theme, account dialog, Google/development login, school selection.
- `public/home.css`, `public/explore.css`, `public/theme.css`: home, explanation, and signed-in design respectively.
- `Wizard-UI-style.md`: reusable visual and interaction rules.
- `tests/pages.test.js`: script syntax, public route references, duplicate IDs, mirrored HTML, and absence of fabricated groups/courses.

The server registers protected HTML routes before the public static directory. Vercel routes requests to `server.js` through `vercel.json`; local development uses `npm run dev`. There is no frontend build step or framework router.

## Data flow

1. Browser requests same-origin JSON through `api()`.
2. Firebase authenticates Google sign-in in the browser. The ID token goes to `POST /api/auth/firebase`.
3. Firebase Admin verifies the token; the server creates/updates the user and stores a seven-day opaque session.
4. An HttpOnly `ch_session` cookie identifies subsequent requests. School-scoped APIs additionally require membership.
5. The server reads/writes libSQL records and returns JSON. Browser code renders actual results with escaped text.

Choosing a school is self-selection; it does not prove enrollment. A student belongs to one school at a time. Changing schools changes the scope of community queries without deleting their previous messages.

## Data model

| Table | Stored information |
| --- | --- |
| users | Firebase identity, email, name, image, bot flag |
| schools | Configured school names |
| memberships | User-to-school membership |
| sessions | Opaque session token and expiry |
| messages | School, channel key, author, text, timestamp |
| online | Last heartbeat per user |
| cheat_sheets | User-owned topic and generated content |
| brewed_docs | User-owned title, body, source, creation time |

New databases do not receive invented schools or students. `COFFEEHOUSE_SCHOOLS` is an explicit JSON array of real school names to provision. An empty list leaves a fresh school catalog empty; the login dialog explains that setup is needed. Existing school rows and user data are preserved.

The two bot rows are functional service identities used to attribute generated replies, not demo students. They are excluded from student discovery.

## Community and messages

`GET /api/channels` returns shared school discussion rooms: General, Homework help, and Study together. These are product rooms, not claims about actual courses or enrollments. Their keys use `channel:HALL:slug`. Old stored course messages are not deleted, but their former hard-coded course entries are no longer listed.

Student Hall loads current identity, channels, students, direct-message threads, and groups. It polls messages roughly every 3.5 seconds and sends an online heartbeat every 30 seconds. Student search filters the returned school directory.

Messages use `GET/POST /api/messages`. Mentioning `@baristi` requests an explanation; `@brewer` summarizes recent channel text. These replies are inserted under the bot identity and appear on polling.

`GET /api/groups` now returns an empty list because the application has no group persistence or management API. The previous invented teams and automatic assignment of real students were removed.

## AI study

- `POST /api/ai/baristi`: sends a question to Gemini and returns its reply.
- `POST /api/ai/baristi/cheats`: generates and saves a cheat sheet.
- `GET /api/ai/baristi/cheats`: lists the current user's saved sheets.
- `POST /api/ai/brewer`: summarizes pasted text or a channel feed and saves a study document.
- `GET /api/brewer/docs`: lists the current user's generated documents.

The Baristi conversation displayed in the workspace is in-memory for that page; saved cheat sheets and Brewer documents persist. No conversation or document is pre-populated. Sources are pasted text or channel messages, not uploaded files. Both assistants use Gemini; there is no NotebookLM integration in the current code.

AI availability requires valid server-side credentials and a model accessible to the account. Missing credentials and generation failures must be shown as errors, never replaced with fabricated answers. Important facts should be checked against course material.

## Settings and appearance

Settings reads `/api/me`, shows the Google profile, and lists available schools. `POST /api/school/join` changes membership; `POST /api/logout` destroys the session. The Google name/image are not editable profile fields in CoffeeHouse.

Day/Night is stored in browser local storage under `ch-theme`. It is an appearance preference, not account data. See the UI guide for palette, responsive, and motion requirements.

## Configuration and running

Use `.env.example` as the configuration-key list. Never commit real secrets.

- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`: production data connection.
- `FIREBASE_WEB_CONFIG`: Firebase browser configuration.
- `FIREBASE_SERVICE_ACCOUNT`, service-account path, or default Google credentials: server verification.
- `BARISTA_API_KEY`, `BREWER_API_KEY` and associated `*_MODEL`: AI access.
- `COFFEEHOUSE_SCHOOLS`: school names to provision explicitly.
- `COOKIE_SECURE=true`: HTTPS cookie in production.
- `DEV_LOGIN=false`: required for production; development login bypasses Google and must only be enabled in an isolated local test environment.

Run `npm install`, then `npm run dev`. Ensure the local `data` directory exists when using a local database. Run `npm test`; on environments that disallow child processes, use `node --test --test-isolation=none tests/pages.test.js`.

## Known backend limitations and release checks

The redesign is not a security audit. The existing direct-message implementation uses `dm:<user-id>` keys rather than canonical two-participant threads; its message API validates key prefixes but does not establish full participant authorization. This needs backend hardening before promising private conversations to students.

Bot replies currently run after the HTTP response using a timer; serverless hosts may terminate that work. A durable job mechanism is needed for reliable background replies. Direct AI workspace requests await generation and do not use that timer.

Before production, verify Firebase authorized domains, real Google login, school configuration, session behavior, AI model availability, and message authorization. Check both themes and mobile navigation. Never remove existing production data merely because earlier code used a hard-coded catalog.
