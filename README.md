# FORM — Personal IF & Wellness Tracker

A privacy-first, offline-capable Progressive Web App for intermittent fasting, nutrition,
weight, water and activity tracking. Thai by default, English available. Built for iPhone
(Add to Home Screen), and responsive on iPad and desktop.

Live: https://donanthavath.github.io/form-if-tracker/

> FORM is not a medical device. Calorie, protein and energy figures are estimates, not prescriptions.

## Features

| Area | What it does |
| --- | --- |
| **Fasting** | Planned schedule (12:12 / 14:10 / 16:8 / 18:6 / 20:4, editable eating start), live countdown, tracked sessions with start / pause / resume / end, back-dating and editing, history, streaks, daily & weekly stats. |
| **Food** | Daily journal with meal type, time, ¼ / ½ / ¾ / custom portions, kcal + protein / carbs / fat, optional photo (compressed on device), notes. Editable personal food library (seeded with common Lao / Thai / Western meals as *estimates*), recent foods, reusable saved meals, undo delete. |
| **Weight** | Daily weigh-ins (one per date), optional waist, chart with 7-day moving average and goal line, 7- and 30-day change (average-based), total lost, BMI, milestones (80 → 75 → 70 kg), and a 4-week trend estimate that is clearly labelled as not guaranteed. |
| **Water & activity** | Quick water logging with undo, editable target, walking / workout / step-count entries, 7-day charts. |
| **Insights** | 7 / 30 / 90-day calorie, protein, fasting-hour and weight trends, goal adherence, meal patterns, the share of entries logged inside the eating window, weekly and monthly tables. |
| **Settings** | Language, dark / light / system theme, time zone (default `Asia/Vientiane`), profile, BMR formula (Mifflin-St Jeor, revised Harris-Benedict, Katch-McArdle) with suggested budget, nutrition and water goals, JSON export / import (merge or replace), delete all data, persistent storage request. |

### How fasting completion is decided

* The **planned schedule** only describes what you intend to do. It never counts as a completed fast.
* A **tracked session** stores timestamps (`startAt`, `endAt`, pauses). Elapsed time is always
  computed as `end − start − paused time`. Nothing depends on a running JavaScript timer, so locking
  the iPhone, closing Safari or crossing midnight doesn't affect it.
* A session is **verified complete** only if it has ended, has no open pause, and its effective fasted
  time is at least the target. Completed sessions are attributed to the local date they ended on, and
  streaks count consecutive such dates (today stays "open" until it ends).
* Manually edited or back-dated sessions are flagged as *edited* in the history.

### Dates & time zones

All local dates (food days, weigh-ins, streak days) are computed in the configured IANA time zone,
`Asia/Vientiane` (UTC+7, no daylight saving) by default. The scheduling code handles DST zones correctly,
and a unit test covers a spring-forward night in `America/New_York`.

## Privacy

* All data lives in **IndexedDB** (via Dexie) on your device. There is no account, backend, analytics or
  ads. Fonts are system fonts, and nothing is loaded from a CDN. Data only leaves the device if you turn
  on one of the optional features below.
* Export a JSON backup regularly from **Settings → Data**. Imports are validated with a strict schema
  and applied in a single transaction, so a bad file can't partially overwrite your data. *Replace* mode
  downloads a backup of your current data first.
* Never commit backup files to this public repository. `.gitignore` excludes `form-backup-*.json`.
* iOS can evict website storage when the device is low on space. Installing to the Home Screen and
  granting persistent storage reduce that risk, and backups are the safety net.

### Optional: Google Sheets sync

Settings → **Google Sheets sync** mirrors every record (photos excluded) into a private spreadsheet
in your own Google Drive, with tabs Daily / Fasting / Food / Weight / Water / Activity. It is off by default.

One-time setup on a computer: open **`/form-if-tracker/#/sheets`**, then:
1. Copy the script, open `script.new`, paste, and save.
2. Deploy it as a **Web app** (*Execute as: Me*, *Who has access: Anyone*) and authorize.
3. Paste the `/exec` URL into FORM on the phone.

The script (`src/sync/appsScript.ts`) is identical for everyone. The first phone that connects claims it
with a random 48-hex token kept in Script Properties, and other requests get `unauthorized`. Run
`resetToken` in the Apps Script editor to connect a different phone. The script creates the spreadsheet
itself on the first sync. "Anyone" only lets the web app receive requests; the spreadsheet stays private.
Sync pushes a full snapshot a few seconds after any change (and when back online), overwriting the tabs,
so FORM stays the source of truth. Free-text cells are escaped against formula injection.

### Optional: Apple Health & Zepp (via Shortcuts)

A web app cannot read HealthKit, so FORM relays it: **Zepp → Apple Health → iPhone Shortcut → your
Apps Script → FORM**. Settings → *Apple Health & Zepp* lists the setup steps.
1. Zepp: Profile → Add accounts → Health.
2. Build a Shortcut that sums today's Steps and Exercise Minutes, reads the latest Weight, and requests the
   link FORM gives you (`…/exec?action=health&key=<health key>&steps=…&ex=…&kg=…`). Run it automatically
   with an Automation (*App → Zepp → Is Closed*, and/or a time of day).

The script (v3) checks a separate 32-hex **health key**, registered by FORM during sync, and keeps one row
per day in a `Health` tab, which normal syncs never clear. FORM fetches those rows with its device token when
it opens. Steps and minutes become one `steps` activity per day (`hk-<date>`). Health weight is only written
on days without a manual weigh-in. Scripts older than v3 are detected, and the card explains how to redeploy
a new version on the same URL.

### Optional: analyze a food photo with ChatGPT (free, no key)

Food → Add → **Analyze photo with ChatGPT**. FORM copies a prompt and opens ChatGPT (`chatgpt.com/?q=…`
opens the app with the prompt filled in). You attach the photo in ChatGPT and send, copy the reply,
and paste it back. FORM parses the JSON reply (`src/lib/chatgpt.ts`), and you review every item before
saving. This uses your own ChatGPT subscription. FORM itself sends nothing. (Third-party apps cannot
sign in with a ChatGPT account, so this hand-off is the supported way to use it.)

### Optional: in-app AI analysis with an Anthropic API key

Settings → **AI food photo analysis**: paste an Anthropic API key (console.anthropic.com, billed per
use: roughly $0.02 per photo on Claude Opus 5.5 or $0.001 on Claude Haiku 5.5). Once a key is set, Food → Add shows an extra **Snap a photo for AI (Claude API)** option.
The downscaled photo goes straight from your phone to `api.anthropic.com` via the official
`@anthropic-ai/sdk` (loaded only when used), using structured output for the dish list and
server-side refusal fallback on Opus. You review and edit every estimate before it's saved.

The API key and the sync URL/token are stored only on the device. They are **never** included in
JSON backups and survive a "replace" import. Anyone with access to the unlocked phone could read them,
so use a spend limit on the API key.

### Platform limitations (honest list)

* **Apple Health**: a browser PWA cannot read or write HealthKit. Steps are entered manually.
* **Notifications**: reminders that fire with the app closed would need Web Push plus a server, so they are not included.
* **Sync is one-way** (phone → Sheet). Edits made in the Sheet are overwritten, and there is no multi-device sync.

## Tech stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Recharts · Lucide icons · Dexie (IndexedDB) ·
vite-plugin-pwa (Workbox) · date-fns + @date-fns/tz · zod · Vitest

```
src/
  lib/        pure logic: fasting, nutrition, weight, insights, time zones (unit-tested)
  db/         Dexie schema, repository actions, seed foods, backup/import/migration
  hooks/      live queries, clock, chart colours
  i18n/       th.ts (source of truth) + en.ts (type-checked to match)
  components/ UI primitives, rings, sheets, food/weight/activity editors
  pages/      Home, Fasting, Food, Progress (Weight / Water & activity / Insights), Settings
tests/        Vitest unit tests + tests/e2e/smoke.mjs (Playwright)
```

## Development

```bash
npm ci
npm run dev        # http://localhost:5173/form-if-tracker/
npm test           # unit tests (fasting, nutrition, weight, insights, backup/import)
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ on http://localhost:4173/form-if-tracker/
```

End-to-end smoke test (needs Playwright with Chromium available to Node):

```bash
npm run build && npx vite preview --port 4173 &
node tests/e2e/smoke.mjs ./screenshots   # optional screenshot dir
```

`node tests/e2e/integrations.mjs` exercises Google Sheets sync, the computer setup page, the ChatGPT hand-off and Claude photo analysis, with both external
endpoints intercepted (no real requests or costs).

The smoke test runs an iPhone viewport in `Asia/Vientiane` and checks: start fast → log foods (verifies totals) → log
weight → insights → reload persistence → **offline reload via the service worker** → English → light theme,
plus no horizontal overflow and no console errors.

Regenerate icons after editing `public/favicon.svg`: `npm run icons`.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs tests and the build on every push and pull request. On `main` it
deploys `dist/` to GitHub Pages.

One-time setup: **Repository → Settings → Pages → Build and deployment → Source: GitHub Actions**.
Choose it in the **Source** dropdown (not the Branch dropdown), and don't use the suggested
"Configure" workflows: this repo already ships its own. Do not deploy from `main / (root)`,
because that would publish the unbuilt source and show a blank page.

* Vite `base` and the manifest `scope` / `start_url` are `/form-if-tracker/`.
* The service worker precaches the app shell. When a new version is deployed, the app shows an
  "Update" prompt instead of reloading on its own.

## Maintenance notes

* **Adding a language string**: add it to `src/i18n/th.ts`. TypeScript then fails until `en.ts` has it too.
* **Changing the database schema**: add a new `this.version(n)` in `src/db/db.ts` with an upgrade
  function. Never edit an existing version. Bump `BACKUP_VERSION` and extend the zod schema if the
  export format changes.
* **Legacy data**: the original single-file app stored data in `localStorage["form-if-v1"]`. On first
  launch it is migrated once into IndexedDB.
