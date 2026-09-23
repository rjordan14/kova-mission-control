# Build: KOVA Sprint Mission Control (hosted team app)

Paste everything below into Claude Code, from the root of an empty repo that also contains this `handoff/` folder.

---

## Context

KOVA is an early-stage startup running a 45-day sprint (Sep 14 → Oct 28, 2026, first investor pitch on Oct 28; the plan extends to a launch the week of Nov 2). We built a working single-user prototype of a "Mission Control" dashboard for the sprint. It saves state to each person's browser (`localStorage`), so teammates can't see each other's changes.

**Your job:** rebuild it as a hosted web app with a **shared database**, so everyone on the core team (5–8 people: Ryan, Brian, Mark, Oleg, Tarek, Jenni, plus occasional partners) sees and edits the same live state.

## Reference material (in `handoff/`)

- `handoff/reference/KOVA Mission Control.dc.html` is the working prototype and the **source of truth for UI, layout, copy and behavior**. It runs via `support.js` in the same folder (serve the folder statically and open the file, e.g. `npx serve handoff/reference`). Read its markup for exact styles and its `class Component` for behavior.
- `handoff/seed.json` has all current plan data, pulled from the prototype:
  - `plan`: weeks W0–W8 (`n`, `range`, `s` start date, `theme`, `items[]` with `t` title, `ws` workstream tag, `o` owner, optional `due` like "Sep 24")
  - `taskInfo`: per-task detail keyed `w{week}-{index}` (`d` is a one-line note, `x` is an array of detail paragraphs)
  - `doneSeed`: task keys already completed
  - `workstreams`: `name`, `owner`, `d` status dot (`green` / `yellow` / `red` / `grey`)
  - `review`: weekly review sections and their prompts
  - `blockers`, `decisions`, `budget`: default lists

Seed the database from `seed.json` on first run (make it idempotent). Match the prototype visually: port its inline styles faithfully. Don't redesign.

## Stack (my recommendation; you may adjust with a short justification)

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**
- **Postgres** via Supabase or Neon, accessed through **Drizzle ORM** with migrations
- **Live sync:** Supabase Realtime if you use Supabase; otherwise poll every 5s plus refetch on window focus. Use optimistic UI for every mutation.
- Styling: plain CSS modules or Tailwind. Keep the prototype's exact oklch values.
- No auth for v1 (decided). The app is reachable by URL only. Add `robots: noindex` and an optional `APP_ACCESS_KEY` env var: when it's set, require `?key=…` once and store it in a cookie. Default is off.

## Identity without auth

No login, but track who did what. On first visit, show a small "Who are you?" picker (names from the owner fields plus free text), stored in `localStorage` and sent with every mutation as `actor`. Show "Ryan checked this · 2h ago" on hover or in the activity log.

## Data model (suggested)

- `weeks` (n, range_label, start_date, theme)
- `tasks` (id, week_n, sort_order, title, workstream, owner, due_label, note, details jsonb string[], done bool, done_by, done_at, hidden bool, source: 'seed' | 'custom', seed_key)
  - Flatten the prototype's seed/custom/edits/hidden/order layers into one table. An "edit" is an update, "remove" sets `hidden = true` (soft delete, restorable), and "move" changes `week_n` + `sort_order`.
- `workstreams` (id, name, owner, status: green | yellow | red | grey, sort_order)
- `blockers` (id, title, needs, meta, resolved bool, resolved_at, resolved_by)
- `decisions` (id, title, meta, description, status: open | decided, resolution text, decided_at, decided_by). Resolving writes a record to the decision log.
- `budget_items` (id, name, amount, status: planned | committed | paid). The budget cap is $40K.
- `investors` (id, name, stage/notes). Check the prototype for its fields; it starts empty.
- `review_notes` (week_n, section_idx, prompt_idx, text, updated_by, updated_at)
- `activity` (id, actor, action, entity, entity_id, payload jsonb, created_at). Append on every mutation.
- `settings` (key, value), e.g. the Slack webhook URL.

## Features to port (all exist in the prototype; match the behavior)

1. **Top bar:** KOVA wordmark, sprint subtitle line, countdown tiles (days to Oct 28 first pitch, days to UI/UX ready on Oct 16, and the others in the prototype), progress ring, and buttons for Weekly review, ▶ Walkthrough and Share.
2. **Three views**, toggled in the top bar and remembered per user:
   - **This week**: the current week is auto-selected by date, with week tabs W0–W8, a progress bar, and the task list.
   - **Full plan**: every week stacked.
   - **Today**: tasks across all weeks grouped by due date relative to today (overdue, today, upcoming). Mirror `todaySections` in the prototype.
3. **Tasks:**
   - check/uncheck (shared)
   - expand to show `note` + `details`
   - inline edit (title, note, workstream, owner, due, details as one per line)
   - add task to a week
   - remove (soft)
   - drag to reorder within a week and drag across weeks (`moveTask`)
   - "push" a task to another week with a new due date (`fp*` handlers / `fpSave`)
4. **Owner filter:** "All" or one person, matched by substring on the owner field, as in the prototype. It applies to every view.
5. **Workstreams panel:** name, owner and a status dot. Clicking the dot cycles green → yellow → red → grey. The rule in the prototype says two yellows in a row means intervene and red means discuss now.
6. **Blockers:** list, add, clear/resolve.
7. **Decisions:** list, add, resolve with a written resolution. Resolved decisions move to a **decision record/log** with who and when.
8. **Timeline strip** at the bottom with phase bands and gate markers. **Derive it from the data** rather than hard-coding it (the prototype's timeline and walkthrough copy are partly stale). Gates to show: UI/UX first pass review Sep 28–29, UI/UX finalized Oct 16, initial build Oct 23, first pitch Oct 28, Oleg audit done + v1 launch Nov 6. Store gates in a `milestones` table (date, label) and seed these five.
9. **Budget:** items with committed / paid / remaining of $40K.
10. **Investors** list (see the prototype).
11. **Weekly review:** step-through modal over the `review` sections, with free-text notes per prompt, saved per week and shared.
12. **Walkthrough:** full-screen guided tour (← → keys, Esc exits). Generate the week steps from the weeks table.
13. **Share:**
    - Copy weekly digest as Markdown (`buildDigest(true)`)
    - Copy full plan as Markdown for Notion (`buildFullPlanMd`)
    - Post the digest to a Slack incoming webhook. Call Slack **from a server route** (the prototype used `no-cors` from the browser). Store the webhook URL in `settings`.
14. **Activity feed:** a small collapsible panel with the last ~50 actions.

## Non-goals for v1

- No login or user accounts
- No Calendar, Notion, Linear or email integrations (Slack webhook only, as above)
- No mobile-specific redesign, but the layout must not break under 900px (stack the panels)

## Quality bar

- Seeding and every mutation go through server actions or API routes with zod validation.
- Two browsers open side by side must converge within a few seconds.
- Concurrent edits: last write wins per field. Checkbox toggles must never be lost.
- Add a `/api/export` endpoint that returns the full state as JSON, to use as a backup.
- Add a README covering local setup, env vars, seeding, deploying to Vercel and resetting from seed.
- Add Playwright smoke tests: load, check a task, add a task, move a task across weeks, resolve a decision.

## How to work

1. Read the prototype and `seed.json` first. Summarize the component/feature inventory back to me before writing code.
2. Propose the schema and folder structure, then build in this order: schema + seed → read-only views that match the visuals → task mutations → blockers/decisions/workstreams → review/walkthrough → share/Slack → activity → tests → deploy.
3. After each step, run the app and compare it against the prototype side by side.
4. Ask me before changing any copy, adding features, or departing from the prototype's look.
