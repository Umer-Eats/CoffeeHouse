# Matcha Mode

Student Hall's Matcha Mode is a local, account-scoped focus ritual. No real drinks are ordered and coupons are digital progression rewards.

## Menu snapshot and prices

Snapshot reviewed 2026-09-22. Sources:
- https://heyteas.com/ — requested menu, category names, drink names, toppings, reference prices.
- https://heyteas.com/fruit-tea/ — fruit descriptions.
- https://heyteas.com/tea-latte/ — latte descriptions.
- https://heyteas.com/milk-tea/ and https://heyteas.com/matcha/ — flavor descriptions.
- https://hyteamenu.org/wp-content/uploads/2026/03/HeyTea-Menu-PDF.pdf — $6.49 Grapefruit Boom and $7.99 Mulberry Boom, named but not priced on the homepage.

The requested official https://www.heytea.com/products page was unavailable during research. heyteas.com is an independent reference, not an official price feed. Its homepage tables and cards disagree. This snapshot prefers homepage category table prices where supplied, then homepage cards. Prices are only used to sort progression within a category, never to charge money. Category duplicates and large variants are separate menu entries, matching the source organization. Descriptions are short original paraphrases of flavor information, not allergen or nutrition guidance. The 49 menu entries include seven drink categories; toppings are order additions, not unlockable drinks.

## Behavior

- Only the cheapest entry per category initially unlocks. Equal-price ties have a stable ID ordering.
- Each drink gets one randomly sampled time: 5–120 minutes in five-minute increments, persisted for that user/browser.
- A topping or nonblank instruction is required. Ordering produces a receipt; tearing it starts the timer. Mouse/touch dragging, clicking and Enter are supported.
- A persisted end timestamp survives reloads and browser timer throttling. A completed session earns exactly one stamp. Cancellation earns nothing.
- Five stamps on a drink enable explicit coupon redemption, unlocking only the next entry in the same category. The final drink awards collection completion.
- The full-screen native dialog makes the background inert. Escape and outside clicks do not dismiss it; Cancel order closes it. Browsers still allow closing tabs or navigating through browser controls; reopening the page restores an active order.
- State is in localStorage under `coffeehouse-matcha-v1:<user id>`; it is not synced across devices and is not a secure reward currency. Clearing browser data clears progression. Storage failure is reported visibly.
- The menu's pixel illustrations are original SVG assets, individually composed with distinct layers, toppings and decorative details. Regenerate using `node browser/build-matcha-art.cjs` after changing the menu.

## Verification

Run `node --test --test-isolation=none tests/*.test.js` in restricted Windows environments, or `npm test` normally. `node tests/matcha-preview.cjs` provides an isolated localhost:3108 UI fixture with a synthetic account and no production database or AI calls.
