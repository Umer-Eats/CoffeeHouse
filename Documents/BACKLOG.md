# CoffeeHouse — Product backlog

Updated: 2026-09-15. Open work only. Reviewed against the current source, not assumptions about production configuration. Priorities: P0 = safety/release blocker, P1 = next improvements, P2 = later. Future ideas are proposals, not implemented features.

See [Documents/Web-structure.md](Documents/Web-structure.md) for current architecture and [Documents/Wizard-UI-style.md](Documents/Wizard-UI-style.md) for the design system. Redesign complete — home page with scroll-reveal feature cards, all inner pages branded with SVG cup logo and shared warm theme, HOME button on all headers, Day/Night toggle matching home page, single community (Pembroke Pines Charter High School), community password requirement, Google sign-in restricted to @pinescharter.net + umerqure475@gmail.com, extended chat box, local time timestamps, and markdown files moved to Documents folder.

## P0 — Before a wider student release

- [x] **Protect direct-message privacy.** Replace ambiguous recipient-only keys with canonical two-participant threads. Authorize both read and write access; safely migrate existing conversations. Add tests proving a third student cannot read another pair's messages.
- [x] **Harden API validation and abuse controls.** Validate types, lengths, school membership, and channel authorization; rate-limit login, messages, and AI requests. Use per-user quotas and spending ceilings for AI.
- [x] **Verify the deployed sign-in flow.** Test Google popup → Firebase verification → session → school selection → Student Hall on the production domain. Confirm authorized domains, secure cookies, and disabled development login. Do not assume deployed settings from local configuration.
- [x] **Make production development-login bypass impossible.** Reject startup or disable the endpoint when development login is enabled in a production deployment.
- [x] **Make channel AI jobs durable.** Replace response-after-timer processing with a durable job lifecycle. Persist queued/running/failed states, prevent duplicate jobs, and retry safely on serverless hosts.
- [x] **Verify real AI service availability.** Exercise both configured models against the production account. Map quota, permission, timeout, and safety failures to friendly, actionable messages without exposing backend details.
- [x] **Introduce trusted school access.** Choose an enrollment policy: approved school domains, staff-approved invitations, or a verification workflow. Self-selection alone is not enrollment proof. Bootstrap administrators explicitly; never make an arbitrary first registrant an admin.
- [x] **Add reporting and moderation safeguards.** Provide report/block controls, school-scoped moderator permissions, and an auditable response process before broad student adoption.
- [x] **Restrict Google sign-in to authorized domains.** Only @pinescharter.net accounts (with one @gmail.com exception) can sign in. Enforce server-side and client-side checks.
- [x] **Require community password for school joining.** Users must enter the correct password (`iluvmatcha`) to join a community, preventing unauthorized account creation.
- [x] **Single school community.** Only "Pembroke Pines Charter High School" is available as the community option.
- [x] **Extend chat box height.** Increase max height by 600px (from 800px to 1400px) to accommodate more messages.
- [x] **Display message timestamps in user's local time.** Updated `fmtTime()` in client.js to show local time for each individual user.
- [x] **Add coffee cup favicon.** Inline SVG data URI favicon added to all HTML pages.
- [x] **Move markdown documentation to Documents folder.** All .md files consolidated into `Documents/` with updated internal references.

## P1 — Reliability and useful everyday features

- [ ] **Persist AI conversations with context.** Add user-owned threads, bounded conversation history, clear "new chat," and deletion controls. Test cross-user isolation.
- [ ] **Stream answers and allow cancellation.** Show partial responses, cancel an in-flight request, handle disconnects, and keep character states synchronized with request state.
- [ ] **Polish AI errors and retries.** Preserve prompts/sources, offer a retry action, and distinguish failed generation from failed saving. Do not substitute canned answers.
- [ ] **Improve loading/reconnection states.** Existing AI, message, and empty states are implemented; add consistent initial directory/shelf loading, offline notices, and session-expired recovery.
- [ ] **Create real rooms and project groups.** Persist channels, groups, memberships, and invitations. Restrict management by school role; support archival without destroying message history.
- [ ] **Improve the message composer.** Multiline input, Shift+Enter, a visible character count, safe draft persistence, and duplicate-send protection.
- [ ] **Add message ownership actions.** Author edit/delete with clear rules, moderation overrides, and a recoverable audit trail where appropriate.
- [ ] **Add source references.** Link notes to the source passages or channel messages that support them; explain when an AI answer has no supporting source.
- [ ] **Add unread state and notifications.** Persist last-read positions, show room/DM badges, and offer opt-in notifications with quiet hours.
- [ ] **Review accessibility end to end.** Keyboard-only and screen-reader tests, contrast in both palettes, focus after actions, live announcements, zoom, and 320px layouts. Motion pause and reduced-motion support already exist.
- [ ] **Expand automated coverage.** Add isolated API/database and authorization tests plus browser flows for login, theme persistence, mobile layout, messaging, AI success/error, and settings.
- [ ] **Add CI checks.** Run tests and lint on pull requests; deploy only after checks pass. Add readable formatting and avoid root/public HTML drift.
- [ ] **Add schema migrations and recovery drills.** Version changes, test backups/restores, and preserve existing users/messages during channel changes.
- [ ] **Define data retention and account controls.** User export, account deletion, school data policies, and clear disclosure of information sent to AI services. Get appropriate review rather than claiming compliance from a UI feature.

## P2 — Platform improvements

- [ ] Replace message polling with an appropriate real-time delivery mechanism and reconnect strategy.
- [ ] Move shared page headers, theme handlers, and repeated markup into a maintainable rendering/template layer.
- [ ] Add privacy-conscious operational monitoring: request failures, job latency, and aggregate AI costs; avoid storing private prompt text in logs.
- [ ] Add a health/readiness endpoint that reveals no secrets.
- [ ] Support school SSO when a participating school needs it.
- [ ] Extend beyond the implemented AI image inputs with authorized document/channel attachments, malware handling, and explicit storage/retention controls.
- [ ] Add a staff administration interface for verified roster and room management, with scoped permissions.
- [ ] Evaluate alternate AI models by measured quality, cost, and latency instead of pinning a speculative upgrade to a model name.

## The idea shelf — future features worth exploring

These are suggestions for later prioritization, not commitments.

- [ ] **Focus table.** A shared Pomodoro session with a pixel hourglass, optional break reminders, and a quiet "studying" status. No microphone or camera required.
- [ ] **Brewer's flashcards.** Turn saved notes into editable flashcards with spaced review and source links. Let students correct AI-generated cards.
- [ ] **Teach it back to Barista.** Explain a concept in your own words; receive hints and questions rather than an immediate answer.
- [ ] **Practice café.** Generate a short quiz from chosen notes, reveal explanations after answering, and track only the student's own progress.
- [ ] **Study session invitations.** Schedule a session in a room, RSVP, and export it to a calendar. Keep reminders opt-in.
- [ ] **Study shelf export.** Print-friendly notes and download as Markdown/PDF for offline revision.
- [ ] **Pinned resources and threaded replies.** Keep useful explanations findable without losing the flow of a room conversation.
- [ ] **Pixel reactions.** A small original set of coffee, lightbulb, leaf, and thank-you reactions; keyboard and screen-reader accessible.
- [ ] **A personal café corner.** Optional desk plants, mug colors, and bookshelf decorations earned through self-chosen goals—not public grades or competitive rankings.
- [ ] **Cozy soundscape.** Opt-in rain, café ambience, or fireplace audio with volume controls. Never autoplay.
- [ ] **Meet the companions.** A little character card explaining what Barista and Brewer can do, with an optional greeting and no interruption during studying.
- [ ] **Seasonal café scenes.** Rainy windows, autumn leaves, or winter lights using the shared motion system and pause control.
- [ ] **A hand-layered scenery pass.** Separate leaf, cat, and lantern sprites from clean scenery plates for larger tail flicks, ear twitches, and branch motion. Current subtle region animation is implemented; this would improve fidelity without moving painted background edges.
- [ ] **Offline reading mode.** Cache only explicitly selected notes on the device, with a clear "remove downloaded data" control for shared computers.
- [ ] **Image-based channel attachments.** Authorized document/channel attachments with malware handling, explicit storage/retention controls, and malware scanning. Build on the image-input.js infrastructure already in place.
- [ ] **Real-time collaborative editor.** Shared whiteboard for study notes with multi-user cursor support and conflict resolution.
- [ ] **AI-generated study schedules.** Generate personalized review schedules from saved notes and cheat sheets, with spaced repetition logic.
- [ ] **Integration with calendar apps.** Export study sessions and deadlines to Google Calendar/Outlook.
- [ ] **Multi-factor authentication.** Add TOTP or email verification as an optional security layer beyond Google sign-in.