# Feature Request: Matcha Mode Leaderboard

## Summary
Add a public leaderboard to Matcha Mode so students can see which community members have unlocked the most drinks and spent the most focus time. Add a "Leader Board" button in the Matcha Mode dialog header next to the existing "Cancel order" button.

---

## Background
Matcha Mode is a focus timer that turns productive sessions into a collectible drink ritual. Students choose from 49 illustrated cups across 7 collections, set timers (5 min – 2 hrs), and earn stamps to unlock new drinks. Progress is stored per-user in `localStorage` (key: `coffeehouse-matcha-v1:{userId}`) and synced with the backend via `/api/matcha/rewards` for gift coupons.

Currently there's no way for students to see how their progress compares to others in their community.

---

## Requirements

### 1. Backend: Leaderboard API Endpoint
**New endpoint:** `GET /api/matcha/leaderboard` (requires auth + school)

**Response:**
```json
{
  "byDrinksUnlocked": [
    { "userId": 12, "name": "Alex", "picture": "...", "unlockedCount": 23 },
    { "userId": 7, "name": "Sam", "picture": "...", "unlockedCount": 19 }
  ],
  "byFocusMinutes": [
    { "userId": 12, "name": "Alex", "picture": "...", "totalMinutes": 1845 },
    { "userId": 3, "name": "Jordan", "picture": "...", "totalMinutes": 1620 }
  ]
}
```

**Data sources:**
- **Drinks unlocked**: Count of categories where `state.unlocked[category] > 0` + first drink in each category (always unlocked). Can be computed from `matcha_gifts` completed coupons (each redeemed coupon = 1 unlocked drink beyond the first) or by scanning each user's localStorage (not feasible server-side). **Recommended**: Add a `matcha_progress` table to track per-user unlocked drinks and total focus minutes, updated on timer completion and coupon redemption.
- **Focus minutes**: Sum of `state.minutes[drinkId] * state.stamps[drinkId]` for all completed sessions. Same recommendation — persist to DB.

**Schema additions (db.js):**
```sql
CREATE TABLE IF NOT EXISTS matcha_progress (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  unlocked_drinks INTEGER NOT NULL DEFAULT 1,  -- first drink in each category = 7 base
  total_focus_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_matcha_progress_school ON matcha_progress(school_id, unlocked_drinks DESC);
CREATE INDEX IF NOT EXISTS idx_matcha_progress_minutes ON matcha_progress(school_id, total_focus_minutes DESC);
```

**Update triggers:**
- In `matcha-gifts.js` `finish()`: increment sender/recipient `total_focus_minutes` by `minutes`
- In `matcha-core.js` `redeem()`: increment `unlocked_drinks` for the user
- In `matcha-mode.js` `finishGift()` / local timer completion: sync progress to server via new `POST /api/matcha/progress` endpoint

### 2. Frontend: Leaderboard UI (Dialog)
**Reference patterns:**
- **UI Wizard** (if exists — otherwise use Matcha Mode dialog patterns): Modal dialog with sticky header, paper texture background, Pixelify Sans font, `mm-` CSS class prefix
- **Matcha Mode** (`matcha-mode.js` / `matcha-mode.css`): `dialog.showModal()`, `.matcha-mode` class, `.mm-top` header, `.mm-content` main, animations via `@keyframes`, reduced-motion support

**New file:** `public/matcha-leaderboard.js` (loaded in `matcha.html`)

**Behavior:**
- Opens as a modal dialog (separate from Matcha Mode dialog)
- Two tabs: "Most Drinks Unlocked" / "Most Focus Time"
- Each row: avatar, name, stat value (e.g., "23 drinks" / "1,845 min")
- Current user's row highlighted
- Pagination or "Load more" (top 50 initially)
- Refresh button (re-fetches from API)
- Close via Escape, backdrop click, or close button

**Animation:**
- Slide up from bottom (like Matcha Mode receipt tear)
- Staggered row fade-in
- Shimmer on current user's row

### 3. Frontend: "Leader Board" Button in Matcha Mode Header
**Location:** In `matcha-mode.js` `open()` function, where `.mm-actions` is constructed (line 82)

**Current HTML:**
```html
<div class="mm-actions">
  <button class="mm-send mm-cancel" type="button" hidden>Send to Friend</button>
  <button class="mm-cancel mm-exit" type="button">Cancel order ×</button>
</div>
```

**New HTML:**
```html
<div class="mm-actions">
  <button class="mm-send mm-cancel" type="button" hidden>Send to Friend</button>
  <button class="mm-cancel mm-leaderboard" type="button">Leader Board</button>
  <button class="mm-cancel mm-exit" type="button">Cancel order ×</button>
</div>
```

**Styling (matcha-mode.css):**
- Same as `.mm-cancel` but distinct hover color (e.g., `--mm-green` background)
- Icon: 🏆 or 📊 (inline SVG preferred)

**Click handler:**
- Opens leaderboard dialog (import from `matcha-leaderboard.js`)
- Does NOT close Matcha Mode dialog — both can be open (leaderboard on top)
- Or: closes Matcha Mode, opens leaderboard (simpler)

---

## Implementation Plan

### Phase 1: Database & Backend
1. Add `matcha_progress` table to `db.js` schema
2. Add `upsertMatchaProgress`, `getMatchaLeaderboard` functions to `db.js`
3. Create `matcha-progress.js` module (like `matcha-gifts.js`)
4. Add `POST /api/matcha/progress` endpoint (auth + school) to accept `{ unlockedDrinks, totalMinutes }`
5. Add `GET /api/matcha/leaderboard` endpoint (auth + school)
6. Wire progress updates in `matcha-gifts.js` `finish()` and `matcha-mode.js` local completion

### Phase 2: Frontend Leaderboard
1. Create `public/matcha-leaderboard.js` with dialog logic
2. Create `public/matcha-leaderboard.css` (or extend `matcha-mode.css`)
3. Add script tag to `matcha.html`
4. Implement tab switching, row rendering, current-user highlight, pagination

### Phase 3: Integration
1. Add "Leader Board" button to Matcha Mode header in `matcha-mode.js`
2. Wire button click to open leaderboard dialog
3. Ensure both dialogs work together (z-index, backdrop)
4. Add keyboard navigation (Tab, Arrow keys between tabs)

---

## UI/UX References

### Matcha Mode (existing)
- **File:** `public/matcha-mode.js`, `public/matcha-mode.css`
- **Patterns:** Dialog with `.matcha-mode` class, paper background, sticky header (`.mm-top`), content area (`.mm-content`), status bar (`.mm-status`), animations via CSS keyframes (`mm-whisk`, `mm-bowl`, `mm-tear-away`), reduced-motion media query

### UI Wizard (reference for wizard-style flows)
- If a wizard component exists, reference its stepper pattern for multi-step flows
- Otherwise, use the tabbed leaderboard as a single-step "view"

---

## Acceptance Criteria
- [ ] `GET /api/matcha/leaderboard` returns top 50 by drinks unlocked and by focus minutes for current school
- [ ] "Leader Board" button appears next to "Cancel order" in Matcha Mode header
- [ ] Clicking it opens a modal leaderboard dialog with two tabs
- [ ] Current user's row is visually highlighted
- [ ] Dialog matches Matcha Mode visual language (paper texture, Pixelify Sans, green accent, animations)
- [ ] Works on mobile (≤650px) with responsive layout
- [ ] Respects `prefers-reduced-motion`
- [ ] Progress updates within ~30s of completing a timer or redeeming a coupon

---

## Files to Modify/Create
| File | Action |
|------|--------|
| `db.js` | Add `matcha_progress` table, queries |
| `matcha-gifts.js` | Update progress on gift finish |
| `server.js` | Add `/api/matcha/progress` (POST), `/api/matcha/leaderboard` (GET) |
| `public/matcha-mode.js` | Add Leader Board button + handler |
| `public/matcha-mode.css` | Style `.mm-leaderboard` button |
| `public/matcha-leaderboard.js` | **New** — leaderboard dialog logic |
| `public/matcha-leaderboard.css` | **New** — leaderboard styles (or extend matcha-mode.css) |
| `public/matcha.html` | Load new scripts |

---

## Notes
- Leaderboard is **school-scoped** (only shows students in same community)
- Privacy: Only shows name, avatar, and aggregate stats — no individual drink history
- Consider adding a "seasonal" reset (e.g., monthly) in future — for now, all-time
- The `matcha_progress` table enables future features: personal stats page, achievements, weekly digests