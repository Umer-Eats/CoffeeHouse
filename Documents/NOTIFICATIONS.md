# Café notifications

Signed-in Student Hall, Study Corner, and Settings load `notifications.js` and `notifications.css`.

- Matcha ordering plays a short two-note confirmation. Normal and gifted timer completion plays a separate four-note cue and shows a pop-up. A gift only reports completion after server confirmation.
- Incoming school-room, personal-group, and direct messages produce an on-screen pop-up and a synthesized steam, bubbling, and cup-clink sound. Pop-ups use text nodes and can open the conversation; Matcha users must leave their session first.
- Bell buttons beside rooms and DM threads mute both pop-ups and message sounds. Choices persist per account, community, and browser, including across tabs. Muting does not hide messages or unread counts.
- The authenticated notification feed is independent of read tracking. Initial connection establishes a cursor without replaying old history. Own messages, other schools, inaccessible groups, and other people's DMs are excluded. Requests poll every four seconds while the page is open. Supported browsers coordinate tabs with Web Locks and favor the focused tab.
- These are in-page alerts, not OS push notifications. Closed pages cannot notify. Browsers require a click or keypress before audio can play, and background tabs can delay timers or polling. Pop-ups still work without audio support. No microphone access, media downloads, or notification permission prompt is needed.

Tests: `tests/message-notifications.test.js` checks the SQL feed's isolation and cursor behavior; `tests/notification-sounds.test.js` checks interaction gating and distinct audio cues. `node tests/notifications-preview.cjs` provides a synthetic UI fixture on localhost:3110 for pop-up, mute, and sound checks.
