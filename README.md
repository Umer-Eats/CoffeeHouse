# CoffeeHouse

**Chat. Study. Grow. Together.**

A cozy online café for students to find their community, work through difficult questions, and make time to focus. CoffeeHouse brings school conversations, AI study companions, personal notes, and a playful focus timer into one pixel-art space.

**[Visit CoffeeHouse →](https://www.coffee-house.app/)**

## Pull up a chair

Studying can start with a quick question, a conversation with a classmate, or a quiet stretch of work. CoffeeHouse gives each of those moments a place.

Meet your classmates in **Student Hall**, bring your questions to **Study Corner**, or choose a drink in **Matcha Mode** and settle into a focus session. Switch between a warm daytime café and a moonlit night scene, with music to keep you company.

## Find your people in Student Hall

Stay connected to your school community through shared rooms and direct messages. Ask for homework help, compare ideas, find other students, and create groups for working together.

- Join conversations in your community's rooms.
- Find classmates in the student directory and message them directly.
- Share files and keep project conversations together.

[Explore Chat →](https://www.coffee-house.app/chat.html)

## Turn questions into understanding

**Study Corner** gives you two AI companions with different jobs:

- **Barista** helps explain concepts, answer questions, and create study cheat sheets. Attach an image or screenshot to give your question context.
- **Brewer** turns source material into organized study notes. Bring text, a conversation feed, images, or a PDF study guide up to **20 MB**.

Return to your saved cheat sheets and study documents when it is time to review. Use the **Notepad** to keep your own thoughts, reminders, and working notes nearby, with automatic saving.

[Explore Study →](https://www.coffee-house.app/study.html)

## Make focus a little ritual

**Matcha Mode** turns a study session into a café order. Open a paper-textured workspace, browse illustrated drinks, and choose how long you want to focus.

1. Choose an unlocked drink. Each drink has a fixed focus time between **5 minutes and 2 hours**, the same for every user.
2. Add a topping or write a special instruction—perhaps the task you want to finish.
3. Place your order and tear off the receipt to start the timer.
4. Work while your drink's brewing animation plays above the countdown.
5. Complete five sessions for a drink, then redeem its coupon to unlock the next drink in that collection.

Want to encourage a friend? Choose **Send to Friend** on your receipt and select someone in your community. They receive the drink in their direct messages. When they finish its timer, **both of you earn a full coupon for that drink**.

Drinks and coupons are digital focus rewards. Regular Matcha progress stays in your browser; completed gift rewards are stored with your account.

[Explore Matcha Mode →](https://www.coffee-house.app/matcha.html)

## Make yourself at home

Choose your display name, manage your school community, and switch between Day and Night themes. The café's pixel artwork, animated scenery, and music give you a space to return to between classes and during study sessions.

[Explore Profile →](https://www.coffee-house.app/profile.html)

## Get started

1. Visit **[coffee-house.app](https://www.coffee-house.app/)**.
2. Explore the feature pages and scrollable previews without signing in.
3. Sign in with Google and join your school community using its community password.
4. Start a conversation, bring a question to Study Corner, or order your first focus drink.

**Your next idea deserves a place to grow. See you at CoffeeHouse.**

---

## For developers

CoffeeHouse uses Node.js, Express, Firebase Authentication, libSQL/Turso, and Gemini, with a vanilla HTML, CSS, and JavaScript frontend.

For configuration and implementation details, see:

- [Application structure and configuration](Documents/Web-structure.md)
- [Visual design and interaction guidelines](Documents/Wizard-UI-style.md)
- [Matcha Mode behavior and gift rewards](Documents/MATCHA-MODE.md)

With Node.js 24 and the required environment configuration in place:

```sh
npm install
npm run build
npm run dev
```

Run the test suite with `npm test`.

## Custom communities and isolated databases

Authenticated users can create a community at `/create-community.html`, available
from the landing-page community picker, Settings, and Profile. Names accept 1–80
characters, and passwords accept 8–64 characters (up to 72 UTF-8 bytes, the bcrypt
limit). Passwords are hashed at cost 12. Creation is limited in the main database
to one successful or pending community per account per rolling 24 hours. Failed
provisioning can be retried with the same name by its creator.

The main database stores accounts, sessions, display names, the community index,
and active memberships. Every community has a separate database for messages,
attachments, groups, read receipts, AI activity, presence, saved study materials,
notes, gifts, and Matcha progress. Middleware establishes a request-local database
context; community queries without that context fail. Account details are read
from the main database when rendering messages. Legacy `school_id` fields remain
as compatibility metadata; physical isolation comes from separate database URLs.

For development, set `TURSO_MULTI_DB_MODE=local`. Files are created under `data/`
(or `COFFEEHOUSE_DATA_DIR`). For production, set `TURSO_MULTI_DB_MODE=platform`,
`TURSO_API_TOKEN`, `TURSO_ORG_NAME`, and optionally `TURSO_DB_GROUP`. The application
uses the [Turso Platform REST API](https://docs.turso.tech/api-reference/databases/create)
to provision `coffeehouse-school-{id}` and mint a database-specific token. Platform
credentials stay on the server. Vercel requires platform mode; local files need
persistent disk storage. Use a separate Turso organization for unrelated app
installations so community database names cannot collide.

If creation reports that setup is incomplete, add these variables in Vercel's
project settings for the **Production** environment, then redeploy:

- `TURSO_MULTI_DB_MODE=platform`
- `TURSO_API_TOKEN`: a **Platform API token**, generated with
  [`turso auth api-tokens mint coffeehouse-provisioning`](https://docs.turso.tech/cli/auth/api-tokens/mint).
  `TURSO_AUTH_TOKEN` is a database token and cannot provision new databases.
- `TURSO_ORG_NAME`: the organization slug from `turso org list`.
- `TURSO_DB_GROUP`: an existing group from `turso group list` in that organization
  (`default` only if that group exists).

With the same environment loaded locally, run `npm run check:communities` to
check required settings, Platform API access, and group existence without
creating anything. This does not test database quotas or write permissions.
Creation failures now log a safe diagnostic under `[community:create]` in Vercel
function logs. Fix the configuration and retry the same name with the same
account; failed attempts do not consume the daily creation allowance.

Before upgrading an existing installation, back up its main database and pause
writes. Set `COFFEEHOUSE_LEGACY_JOIN_PASSWORD` to an initial password for existing
communities, then run `npm run migrate:communities` with the target environment.
Migration runs explicitly through that command, separately from web requests.
Public pages and sign-in remain available before migration is configured. Legacy
communities remain unavailable until their migration succeeds. The migration
copies school-scoped records, attachments and group members while preserving IDs.
Private saved items follow their owner's active membership. It marks the community
ready only after copying succeeds; reruns resume safely. Original tables remain
in the main database as a migration backup and are never used by live community
requests. Users without memberships retain their legacy private records there;
these need an explicit community assignment before migration. Keep the legacy
password configured if you continue seeding new names via `COFFEEHOUSE_SCHOOLS`.

`POST /api/school/create` accepts `{ "name": "Study group", "password": "a long phrase" }`
and returns `{ "school": { "id": 1, "name": "Study group", "dbUrl": "..." } }`.
`POST /api/school/join` accepts a community `name` (or the existing `schoolId`) and
`password`. Both activate the membership using the existing global session.
The catalog and account endpoints never return database credentials or hashes.
Google sign-in accepts accounts from any email domain; Firebase still verifies
every ID token. The community catalog is public and includes existing communities
that are awaiting setup. Those entries are labeled as pending and cannot be
joined until their database migration succeeds. Community content still requires
sign-in and membership with the correct community password.

Community owners see **Delete community** in Settings for their active community.
They must type its exact name before `DELETE /api/school/:id` with
`{ "confirmName": "Study group" }` can remove it. The server checks `created_by`,
independently of membership and the browser controls. Deletion blocks further
access and joins, removes the separate community database and all memberships,
and clears its credentials/password hash. Accounts and sessions are preserved.
A minimal deleted index entry prevents configured names from being reseeded and
keeps the owner's daily creation limit. A failed deletion remains unavailable
and the owner can retry it from Settings. Provider backups follow Turso's retention
policy; old main-database migration backups remain administrator-managed.
On Windows, libSQL can retain a closed file handle; local deletion empties and
vacuums the database before removal, so an empty file can remain until restart.

The production Platform API token now also needs **`db:delete`**, alongside
`read`, `db:create`, and `db:mint-token`, limited to the configured database group.
This feature never deletes the main database or a different community's database.

Matcha progress syncs to the active community database; the browser cache is
namespaced by account and community. Previous global browser-only progress is
left intact locally because it has no reliable community attribution.
