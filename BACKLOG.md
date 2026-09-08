# CoffeeHouse — Product Backlog

> Living document. Last updated: 2026-09-07

---

## Table of Contents

1. [Firebase Integration & Authentication](#1-firebase-integration--authentication)
2. [Domain-Specific Login & School Server Control](#2-domain-specific-login--school-server-control)
3. [AI Integration — Real Gemini APIs & Study Bots](#3-ai-integration--real-gemini-apis--study-bots)
4. [UI Fixes & Cleanup](#4-ui-fixes--cleanup)
5. [Infrastructure & Code Quality](#5-infrastructure--code-quality)
6. [Future Features (Nice to Have)](#6-future-features-nice-to-have)

---

## 1. Firebase Integration & Authentication

### Current State
- `firebase-admin` SDK is installed and wired up in `server.js:30-51`.
- Frontend loads Firebase compat SDK from CDN (`index.html`).
- **Firebase is NOT configured** — `.env` has empty `FIREBASE_WEB_CONFIG` and `FIREBASE_SERVICE_ACCOUNT_PATH`.
- App currently falls back to `DEV_LOGIN=true` (anyone can create accounts with any email).
- Session cookie is HttpOnly, SameSite lax, but `COOKIE_SECURE` is not enabled.

### Backlog

| Priority | Task | Details |
|----------|------|---------|
| **P0** | Configure Firebase project | Create Firebase project, enable Google sign-in provider, generate web config and service account key. Fill `.env` values. |
| **P0** | Test full Firebase auth flow | Verify popup sign-in → ID token → server verify → session cookie → redirect to `student.html`. |
| **P0** | Disable `DEV_LOGIN` in production | Set `DEV_LOGIN=false` in `.env` for production builds. Keep it as an option for local dev only. |
| **P1** | Enable `COOKIE_SECURE=true` for production | Ensure cookies are only sent over HTTPS. Add env check or auto-detect based on `PORT` / deployment. |
| **P1** | Add Firebase Auth domain | Add production domain to Firebase console → Authentication → Settings → Authorized domains. |
| **P1** | Handle Firebase token refresh | Frontend should call `user.getIdToken(true)` before expiry to keep the session alive. Currently no refresh logic exists. |
| **P2** | Add email/password auth as fallback | Some students may not have Google accounts. Add email+password sign-up/in alongside Google. |
| **P2** | Add "Sign in with School SSO" (SAML/OIDC) | For schools that use Azure AD, Okta, or Google Workspace. Firebase supports federated identity providers. |
| **P2** | Session expiry notification | Warn users when their session is about to expire (7-day TTL). Show a modal to re-authenticate. |
| **P3** | Account deletion / GDPR compliance | Add endpoint `DELETE /api/me` that removes user data, sessions, messages, and brewed docs. |
| **P3** | Rate limiting on auth endpoints | Prevent brute-force abuse on `/api/auth/firebase` and `/api/auth/dev`. Use `express-rate-limit` or similar. |

---

## 2. Domain-Specific Login & School Server Control

### Current State
- Three schools are seeded on startup: Pembroke Pines Charter, American Heritage, West Broward.
- Any authenticated user can join any school via `POST /api/school/join`.
- No validation that a student actually attends the school they joined.
- No admin roles — every user has the same permissions.
- Channels are hardcoded in `server.js:56-78` (4 classes, fixed sub-channels).
- Project groups are regenerated from templates on every request.

### Backlog

| Priority | Task | Details |
|----------|------|---------|
| **P0** | Domain-restricted registration | Validate user email domain on signup. E.g., `@ppcharter.edu` → auto-assign to Pembroke Pines. Reject emails from unapproved domains. |
| **P0** | School admin seeding | Allow a school admin account to be designated (e.g., first user or via env var `ADMIN_EMAILS`). Admins can manage channels and students. |
| **P1** | Dynamic channel management | Move class/channel definitions from hardcoded constants to the database. Admins create/edit/delete classes and sub-channels through a management UI. |
| **P1** | School-scoped invite codes | Generate unique invite codes per school. Students enter a code during registration to confirm membership. Prevents unauthorized school access. |
| **P1** | Student verification workflow | When a student joins a school, admin receives a notification to approve/deny. Students see "Pending approval" state. |
| **P2** | Admin moderation tools | Admins can delete messages, mute/ban users, and view audit logs. Add `is_admin` column to `users` table scoped per school. |
| **P2** | Role-based access control (RBAC) | Define roles: `student`, `teacher`, `admin`, `mod`. Teachers can pin messages, create announcements. Admins manage school settings. |
| **P2** | School settings page | Per-school configurable settings: display name, logo, color theme, announcement board, allowed external domains. |
| **P2** | Bulk import students | CSV/Google Sheets import for teachers to add entire class rosters at once. |
| **P3** | Multi-school dashboard | Super-admin view across all schools: user counts, active channels, AI usage stats. |

---

## 3. AI Integration — Real Gemini APIs & Study Bots

### Current State
- `@google/generative-ai` SDK installed (v0.21.0). Gemini API key is set in `.env`.
- Model: `gemini-2.5-flash`. Used for both Baristi and Brewer bots.
- **Baristi**: Direct chat + cheat sheet generation. Summable via `@baristi` in channels.
- **Brewer**: Paste text → structured study doc (key terms, concepts, quiz questions). Optional NotebookLM Enterprise integration.
- Bot replies in channels are truncated to 4000 characters.
- No streaming — responses are buffered before display.
- No conversation history — each query is stateless (no context window management).
- NotebookLM Enterprise integration is not configured (`NOTEBOOKLM_ENABLED=false`).

### Backlog

| Priority | Task | Details |
|----------|------|---------|
| **P0** | Validate Gemini API key is working | End-to-end test: send a prompt via `/api/ai/baristi`, confirm response from `gemini-2.5-flash`. Debug any CORS or quota issues. |
| **P0** | Add conversation context to Baristi | Store last N messages per user in a server-side context array (or DB). Pass history to Gemini so follow-up questions make sense. |
| **P0** | Handle Gemini errors gracefully | Currently a failed Gemini call shows a raw error in chat. Parse common errors (quota exceeded, safety filter, invalid key) and show friendly messages. |
| **P1** | Streaming responses for Baristi | Use Gemini's streaming API (`generateContentStream`) to show tokens as they arrive in the AI workspace. Update frontend to render incrementally. |
| **P1** | Add conversation history persistence | Store Baristi chat sessions in a `chat_sessions` table. Allow users to go back to previous conversations. |
| **P1** | Brewer: load channel context | Allow Brewer to pull messages from a selected channel as source material (already partially implemented for `@brewer` in chat). Expose a dropdown in the AI workspace. |
| **P1** | Brewer: structured output format | Currently the study doc is a raw text blob. Parse it into sections (Key Terms, Core Concepts, Quiz, Open Questions) and render with proper HTML/Markdown. |
| **P2** | Upgrade to Gemini 2.5 Pro for complex tasks | Use `gemini-2.5-pro` for Brewer (heavier synthesis) while keeping `gemini-2.5-flash` for Baristi (quick answers). Add model selection to `.env`. |
| **P2** | NotebookLM Enterprise integration | Configure and test the real NotebookLM API flow: create notebook → upload source → query. Requires enterprise license and `gcloud auth`. |
| **P2** | AI usage analytics | Track per-user and per-school AI usage (queries, tokens consumed). Add a lightweight analytics table and a teacher/admin dashboard. |
| **P2** | @brewer in-channel enhanced flow | Currently `@brewer` in chat generates notes from the last 40 messages. Improve: let user specify scope (last 10, 20, 50 messages), show a loading indicator, display the brew as a formatted card. |
| **P2** | Cheat sheet formatting | Cheat sheets are stored as raw text. Convert to Markdown/HTML with headers, bullet points, and code blocks for better display. |
| **P3** | Custom system prompts per school | Allow admins to customize bot personality and subject focus per school (e.g., AP Bio emphasis vs. IB emphasis). |
| **P3** | Gemini Vision integration | Allow students to upload images (diagrams, handwritten notes) and have Baristi explain them. Requires enabling `gemini-2.5-flash` vision capabilities. |
| **P3** | Study mode / quiz mode | Interactive quiz generation from uploaded material. Students answer questions, get scored, and see explanations. |
| **P3** | Summarize entire channel history | "Summarize this semester's BIO-301 discussions" — aggregate all messages in a channel and synthesize. |

---

## 4. UI Fixes & Cleanup

### Current State
- Four HTML pages: `index.html`, `student.html`, `settings.html`, `ai-assistant.html`.
- **All CSS is inline and duplicated** across every page (~200+ lines repeated 4x).
- No separate CSS files, no build tools, no CSS framework.
- Pixel-art retro aesthetic: "Press Start 2P" headers, "VT323" body, day/night theme toggle.
- Pixel art engine renders 7 sprites on canvas (decorative only).
- Some UI inconsistencies across pages (padding, spacing, button styles).
- No loading states, no error toasts, no empty states for lists.
- Mobile responsiveness is basic but incomplete.

### Backlog

| Priority | Task | Details |
|----------|------|---------|
| **P0** | Extract shared CSS into `styles.css` | Deduplicate all repeated CSS (variables, body, buttons, theme toggle, pixel borders) into a single shared file. Link from all HTML pages. |
| **P0** | Add loading states | Show spinners/skeletons while data loads (channel list, messages, students, AI responses). Currently no visual feedback during fetches. |
| **P0** | Add error toasts | Global toast notification system for API errors, network failures, and success confirmations. Replace raw `alert()` calls and silent failures. |
| **P1** | Empty state designs | Add friendly empty states for: no messages in channel, no DMs, no cheat sheets, no brewed docs, no search results. Include pixel-art illustrations. |
| **P1** | Mobile responsive overhaul | Test and fix layout on 320px–768px viewports. Sidebar collapse, touch-friendly tap targets, proper viewport meta. |
| **P1** | Fix inconsistent spacing/padding | Audit all pages for consistent `16px`/`24px`/`32px` padding rhythm. Align card styles, section headings, and button spacing. |
| **P1** | Dark mode polish | Audit dark mode colors for contrast (WCAG AA). Fix any hard-to-read text, missing hover states, or invisible borders in dark theme. |
| **P1** | Message input UX improvements | Add Shift+Enter for newlines, character count indicator (4000 max), paste-to-upload placeholder, auto-resize textarea. |
| **P1** | Typing indicator for AI | Show "Baristi is thinking..." animation while waiting for Gemini response. Currently no feedback during the 2–5s API call. |
| **P2** | Extract shared JS into `utils.js` | Deduplicate repeated JS helpers across pages (time formatting, avatar rendering, API wrapper, theme toggle). |
| **P2** | Accessibility audit | Add ARIA labels, keyboard navigation, focus management, and screen reader support. Ensure all interactive elements are accessible. |
| **P2** | Search UX in student directory | Improve directory search: debounced input, highlight matching text, sort by relevance, show "no results" state. |
| **P2** | Settings page redesign | Better layout for profile info, school selector, theme toggle, and future options. Add sections with clear visual hierarchy. |
| **P2** | Pixel art sprite improvements | Add hover animations on sprites, make them interactive (click for info), or use as page transition decorations. |
| **P3** | Customizable themes | Let users pick accent colors beyond day/night. Add a theme picker in settings. |
| **P3** | Onboarding flow | First-time user walkthrough: choose school, intro to channels, intro to AI bots, set profile picture. |
| **P3** | Notification badges | Show unread message counts on channel list items and DM threads. |

---

## 5. Infrastructure & Code Quality

### Current State
- Single-file backend (`server.js` — 410 lines), single-file DB layer (`db.js` — 309 lines), single-file AI layer (`ai.js` — 148 lines).
- SQLite with WAL mode via `node:sqlite` (requires Node 22.5+).
- No tests, no linting, no CI/CD.
- No rate limiting, no request validation middleware.
- API key stored in plaintext `.env`.
- Polling every 3.5s for messages (not WebSocket/SSE).
- Channel structure is hardcoded, not database-driven.

### Backlog

| Priority | Task | Details |
|----------|------|---------|
| **P0** | Add request validation | Use `zod` or `joi` to validate all API inputs. Prevent malformed data at the edge. |
| **P0** | Add rate limiting | Protect `/api/auth/*`, `/api/ai/*`, and `/api/messages` endpoints. Use `express-rate-limit` with per-IP and per-user limits. |
| **P1** | Migrate to WebSockets or SSE | Replace 3.5s polling with Socket.io or Server-Sent Events for real-time message delivery. Reduces server load and improves UX. |
| **P1** | Add ESLint + Prettier | Configure linting and formatting for consistent code style. Add a `lint` npm script. |
| **P1** | Add basic test suite | Unit tests for `db.js` functions, integration tests for API routes. Use `vitest` or `node:test`. |
| **P1** | Modularize server.js | Split routes into separate files (`routes/auth.js`, `routes/channels.js`, `routes/ai.js`). Keep `server.js` as the entry point only. |
| **P2** | CI/CD pipeline | GitHub Actions workflow: lint → test → build → deploy. Auto-deploy to Vercel/Railway/Fly.io on push to `main`. |
| **P2** | Database migrations | Add a migration system (e.g., `node-pg-migrate` style or custom) for schema changes. Currently schema is created inline in `db.js`. |
| **P2 | Message edit/delete | Add `edited_at` column to messages. Allow authors to edit/delete within a time window. Add admin delete (no time limit). |
| **P2** | File upload support | Add image/file uploads for chat messages and AI workspace. Use local storage or S3-compatible object store. |
| **P2** | Health check endpoint | `GET /api/health` that returns DB connectivity, Gemini key status, and uptime. Useful for monitoring. |
| **P3** | Containerization | Dockerize the app with a `Dockerfile` and `docker-compose.yml` for easy deployment. |
| **P3** | Horizontal scaling | Move sessions to Redis. Use a message queue for AI calls. Support multiple server instances behind a load balancer. |

---

## 6. Future Features (Nice to Have)

| Feature | Description |
|---------|-------------|
| **Calendar integration** | Sync class schedules, show upcoming exams, remind about homework deadlines. |
| **File sharing in channels** | Upload notes, PDFs, and images directly in class channels. |
| **Threaded replies** | Reply to specific messages in channels (Discord-style threads). |
| **Reactions / Emoji** | React to messages with emoji. Pixel-art emoji set to match the aesthetic. |
| **Voice channels** | Real-time voice chat rooms for study groups (WebRTC). |
| **Study timer** | Pomodoro-style timer integrated into the AI workspace. Track study sessions. |
| **Progress tracking** | Visualize completed cheat sheets, brewed docs, and study streaks. |
| **Parent / Teacher portal** | Separate login for parents/teachers to monitor student activity and AI usage. |
| **Mobile app** | Wrap in Capacitor or build a React Native companion app. |
| **Export / Print** | Export cheat sheets and study docs as PDF or Markdown for offline use. |
| **Gamification** | XP system for helpful messages, AI usage milestones, and study streaks. Pixel-art badges and achievements. |

---

## Sprint Suggestion

### Sprint 1 — Core Auth & Firebase (Week 1)
- Configure Firebase project and fill `.env`
- Test full auth flow end-to-end
- Disable DEV_LOGIN in production
- Enable secure cookies
- Domain-restricted registration

### Sprint 2 — AI & Bot Improvements (Week 2)
- Validate Gemini API key and test Baristi/Brewer
- Add conversation context to Baristi
- Improve error handling for Gemini failures
- Typing indicator for AI responses
- Brewer structured output format

### Sprint 3 — UI Cleanup & Shared CSS (Week 3)
- Extract shared CSS into `styles.css`
- Add loading states and error toasts
- Empty state designs
- Message input UX improvements
- Mobile responsive fixes

### Sprint 4 — School Controls & Admin (Week 4)
- Dynamic channel management (DB-driven)
- School admin seeding and RBAC
- Invite code system
- Student verification workflow
- Admin moderation tools
