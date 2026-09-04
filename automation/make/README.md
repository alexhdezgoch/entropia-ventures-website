# Make.com automation: dentist demo

This folder holds the exported blueprints for the two Make.com scenarios that run the
live dentist lead-response demo. See the design spec at
`~/work/entropia-ventures/specs/2026-09-03-live-dentist-demo-design.md` for the full
architecture and rationale.

## What each scenario does

**Scenario 1: Dental demo intake** (Make scenario id 6147344, blueprint
`intake.blueprint.json`)

Listens on one custom webhook (hook id 2769910). A router branches on the `event`
field in the incoming payload:

- `event=form`: creates the Notion lead row (Status: New, Received at, Lead ID),
  emails the clinic inbox with the new lead, emails the patient a link to the
  qualifying questions, then updates the row to Status: Contacted.
- `event=qualify`: writes the patient's answers to the Notion row, calls Claude
  Haiku 4.5 over HTTP to draft a treatment estimate from a fixed price table, writes
  the estimate and proposal text back to Notion (Status: Pending approval), and sends
  a summary to Telegram with inline Approve and Reject buttons.
- `event=proposal`: reads the row by Lead ID and returns the proposal as an HTML
  page, so `p/{id}` on the site can show a clean link to the patient.

**Scenario 2: Dental demo approval** (Make scenario id 6146823, blueprint
`approval.blueprint.json`)

Listens on a second custom webhook (hook id 2771110) that receives Telegram button
callbacks:

- Approve: reads the Notion row, emails the patient the proposal link, updates the
  row (Status: Proposal sent, Proposal sent at), and edits the Telegram message to
  show the send time.
- Reject: updates the row (Status: Rejected) and edits the Telegram message to show
  Rejected.

## Connections

Both scenarios use these Make connections, all under the alex@entropia.ventures
Make account:

- Notion (the "Dental Leads (demo)" database)
- Gmail (alex@entropia.ventures, for clinic and patient emails)
- Telegram Bot (Alex's own demo bot, created via BotFather)
- HTTP (Anthropic API, for the Claude Haiku estimate call)

## Secrets

Secrets live only in Make, inside the scenario's connections and module
parameters. They are never checked into this repo. The blueprints in this folder
have three values replaced with placeholders before commit:

- `__ANTHROPIC_API_KEY__` in place of the Anthropic API key
- `__TELEGRAM_BOT_TOKEN__` in place of the Telegram bot token
- `__FORM_SECRET__` in place of the shared secret the demo form sends with each
  webhook call

To re-import a blueprint, put the real values back into the connection or module
parameters in the Make UI after import. Do not paste real secrets into this
repo at any point.

## Re-importing a blueprint

1. In Make, go to Scenarios and choose Create a new scenario, or open an existing
   scenario's menu and choose Import Blueprint.
2. Upload the `.json` file from this folder.
3. Make will ask you to reconnect each module to a live connection (Notion, Gmail,
   Telegram, HTTP). Pick or create the real connections; the placeholders above are
   not valid credentials.
4. For the webhook modules, reattach the existing hook (by id, see above) or create
   a new one and update the demo pages / Telegram bot webhook URL to match.
5. Save, then run a manual test before turning the scenario on.

## Known Make quirks (found the hard way during Phase 1-3 build)

- **updateADatabaseItem needs the UI-generated metadata block.** Building or editing
  this module's parameters by hand (via API PATCH) does not work reliably. The
  module needs the `metadata.restore` block that Make's own UI generates when you
  configure the module by hand in the scenario editor. If a Notion update module
  stops working after an API-based edit, open it in the UI, re-pick the database and
  fields once, and save — that regenerates the metadata block correctly.
- **makeApiCall drops the request body.** The generic `makeApiCall` module (used to
  call Make's own API from within a scenario) silently drops the request body on
  some call shapes. Do not rely on it for anything where the body must arrive
  intact. Prefer a plain HTTP module instead.
- **Arrays are 1-indexed.** Blueprint mapper expressions and router route arrays
  count from 1, not 0. This trips up anyone used to 0-indexed arrays when hand-editing
  a blueprint's `routes` or iterator output.
- **Structural PATCH can fail with 22P02.** Trying to PATCH a scenario's blueprint
  structure directly (adding or moving modules) can fail with a Postgres error
  22P02 (invalid input syntax) on Make's backend. When that happens, recreate the
  scenario via POST (create a new scenario with the full blueprint) instead of trying
  to patch the existing one in place. This was the reason for going through the
  `v2`, `v5`, `v6`, `v7`, `v9`, `v10` blueprint iterations recorded in the build
  history rather than patching v1 forward.
