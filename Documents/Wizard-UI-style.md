# CoffeeHouse UI style guide

## Design intent

CoffeeHouse is a welcoming pixel-art café for students. The home page is the visual anchor: wooden counters, hanging plants, a sunlit window, cream lettering, and a steaming cup. Night becomes a quiet indigo world with cherry blossoms, lavender borders, and warm lanterns. Keep these as two deliberately designed palettes, not an inverted image.

Art is scenery; the interface is HTML. Never place an entire screenshot behind invisible click targets. Headings, navigation, buttons, account details, messages, and study documents must remain selectable, responsive, and accessible.

## Source files

- Home and public navigation: `index.html`, `public/home.css`, `public/home.js`.
- Public Chat / Study / Profile: `public/chat.html`, `public/study.html`, `public/profile.html`, `public/explore.css`.
- Signed-in design system: `public/theme.css`.
- Pixel SVG cup / sun / moon symbols are embedded in the HTML. Small decorative canvas sprites come from `art.js`.
- Scenery: `public/images/cafe-scenery-day.png` and `cafe-scenery-night.png`. Their provenance is recorded in `public/images/SCENERY.md`.

## Palette

| Role | Day | Night |
| --- | --- | --- |
| Header | Espresso #3c261a | Midnight #121132 |
| Panel | Wood #432a1b | Indigo #151531 |
| Raised panel | #583b28 | #232044 |
| Main text | Cream #fff0cf | Pale lavender #eee4ff |
| Secondary text | #e5c9a2 | #c6b8df |
| Primary accent | Gold #f7cf89 | Lavender #c4b0ff |
| Panel border | #ac8155 | #75659e |
| Personal message | Moss #4c5935 | Plum #3b2c50 |

Use the CSS variables rather than scattering new colors through components. Baristi uses a warm gold accent; Brewer uses lilac. Errors need visible explanatory text, not just a red tint. Documents use a light paper surface in Day and a dark readable surface in Night.

## Typography and spacing

Use Pixelify Sans for brand, page titles, and section headings. Use VT323 for readable body copy, controls, message text, and metadata. Both retain the pixel identity without making long messages difficult to read. Monospace is the fallback.

AI answer bodies are the readability exception: use the system sans-serif stack at 17px (16px on phones), with 1.7 line height. `public/ai-format.js` renders Markdown and KaTeX equations; `public/ai-format.css` styles headings, lists, code, and notes. Keep pixel fonts on the surrounding interface. Equations include accessible MathML and scroll inside the answer when too wide. Never enable raw HTML or trusted math commands in generated content. Ordinary student messages remain plain text.

Body text is approximately 21–24px; metadata 15–19px; section headings 21–28px; page headings 32–72px depending on the page and viewport. Do not use tiny all-caps text for paragraphs.

Use a 4px spacing rhythm. Typical gaps are 12, 16, 24, and 32px. Content containers stop near 1320–1440px. Do not position functional content at coordinates copied from a reference image.

## Component patterns

### Navigation

Public pages share Home, Chat, Study, Profile, Login, and Day/Night. Mark the current link with `aria-current="page"` and an underline. Chat/Study/Profile are explanations available before login. Primary calls to action open the real account dialog; authenticated users enter Student Hall.

Signed-in pages use the same cup wordmark and explicit links to Home, Student Hall, AI Study, and Settings as appropriate. Use the real signed-in identity only. Avoid hard-coded names or avatars.

### Panels and controls

Use solid, high-contrast wooden or indigo panels, 1–2px borders, mostly square corners, and hard offset shadows. Theme and account pills can retain the rounded silhouette of the reference header. Avoid glass blur, shiny gradients, and unrelated modern dashboard icon packs.

Primary actions use a solid gold/lavender fill with dark text. Secondary actions use the panel color and a visible border. Hover lifts a button 2px; pressed state shifts it down and reduces the shadow. Disabled actions are visibly dimmed and must not submit twice.

Inputs are dark inset surfaces with persistent labels or accessible names. Placeholder hints are allowed as input guidance, never as a substitute for a label or as fake saved data. Restore draft text when sending fails.

### Public explanation pages

Use a two-column editorial hero: short eyebrow, large statement, concise explanation, one account action, and a framed café window. Follow with three explanatory cards and a closing note. The window may contain a pixel icon and short sign; it is decorative, not an imitation live conversation.

### Student Hall

Desktop: room list, conversation, school directory. The conversation has a room title, messages, AI mention shortcuts, and a composer. Message bubbles show actual authors and timestamps. Empty rooms invite the first message. Do not generate a greeting from a nonexistent participant.

Room items and directory rows must work with Enter/Space as well as pointer input. Keep messages and sidebar lists scrollable without forcing the entire page into a fixed desktop-height frame.

### AI Study

Separate Baristi and Brewer with explicit controls. Baristi begins with an instructional empty state, not a fabricated bot message. Brewer accepts user-supplied text or an actual channel feed. The study shelf contains persisted cheat sheets/documents only. Do not present suggested prompts as past conversations.

Always distinguish a loading state, service error, empty result, and saved result. Explain that AI can make mistakes. Preserve source text when generation fails.

### Settings

Show the real Google profile, current school, school selector, and logout control in separate panels. Do not invent achievements, activity counts, account plans, or profile fields that cannot be saved. The shared Day/Night control changes the local appearance preference.

## Responsive rules

Public heroes and feature cards stack below 800px. The Hall reduces to two columns below 1100px, moving the directory below the conversation; below 720px all panels stack. AI's saved shelf remains visible below the workspace on mobile. Settings becomes a single column.

Never hide the only access to channels, direct messages, settings, or saved study materials to make a mobile screenshot fit. Allow vertical scrolling, prevent horizontal overflow, and use flexible input widths. Test at 390px and a desktop width.

## Theme and animation

The preference key is `ch-theme`, with `light` and `dark` values. Public pages apply it to the HTML element; signed-in pages apply it to the body. The explicit theme buttons must synchronize `aria-pressed` and the scenery palette. Page controllers own button events; `Art.initTheme()` only initializes the art palette.

Shared motion lives in `public/motion.css` and `public/scenery.js`. Every scenery-bearing page uses a 450ms opacity crossfade between separately loaded Day/Night paintings, matching Home. Panel, text, and border colors transition for the same duration. Do not try to transition a background-image URL directly.

The existing paintings are animated in a decorative canvas layer, never as the interface itself. Leaf regions sway with 5.5px gusts; cursor proximity adds an eased repulsion of up to 18 source pixels without replacing the breeze. Force tapers outside foliage and returns smoothly to zero after the pointer leaves. Pointer coordinates map through the actual cropped/scaled canvas; touch input and foreground controls do not trigger it. The sleeping cat breathes with its paws anchored. Stronger lantern glow, curling steam, drifting leaves/petals, and night-star twinkles stay behind content. Coordinates refer to the original 1751 × 898 artwork and resize with cover positioning. A future separated-sprite art pass can support larger motion without distorting painted edges.

Scenery renders at no more than 15 frames per second, skips inactive theme canvases, and stops scheduling while the tab is hidden or the scene is offscreen. A persistent Pause scenery control freezes decorative motion. `prefers-reduced-motion` disables all animation and transitions and keeps a static scene; it takes precedence over the stored `ch-scenery-paused` preference.

Barista and Brewer are code-native pixel SVG characters defined in `public/companions.js`. Barista is a cream coffee-cup companion in a green apron; Brewer is a lavender kettle companion with a stirring spoon. Both have quiet idle breathing, blinking, and steam. `CoffeeCompanions.setBusy(name, true)` switches to stepped working/stirring animation and announces a waiting status. Call it immediately before an AI request, and reset in `finally` on either success or error, including cheat-sheet saving. Do not use a fixed-duration animation as a proxy for a network request. Backend aliases such as `@baristi` remain compatible even though the display name is Barista.

Small canvas plants sway from their base and lantern sprites glow. Do not animate readable text, make the whole background pan continuously, or put particles over messages. New motion must work with both the pause control and reduced-motion preference.

## Accessibility and content checks

- Use one page H1, semantic navigation/main sections, real links/buttons, and useful accessible names.
- Keep keyboard focus visible with a 3px accent outline.
- Dialogs have a title, explicit close button, native Escape handling, and status text.
- Decorative SVGs and scenery are hidden from assistive technology.
- Loading and errors must explain what is happening and how to recover.
- Never invent classmates, enrollments, groups, grades, testimonials, or AI output.
- Review both palettes, long names/messages, keyboard behavior, empty data, and phone layouts.

### AI image attachments

Use `public/ai-images.js` and `public/ai-images.css` for both assistants. Provide a visible attach button, thumbnail previews, individually labeled Remove buttons, and a live preparation/error status. Support image paste while a field in the assistant is focused without interfering with ordinary text paste. Show format/count limits and the provider privacy notice before sending. Disable submission during image preparation and requests; preserve attachments after errors so students can retry. Keep thumbnails contained without cropping worksheets, and keep filenames readable in both palettes.
