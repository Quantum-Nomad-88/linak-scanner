# CLAUDE.md — AI Developer Brief for the LINAK Actuator Toolkit

This file gives an AI assistant (Claude or similar) everything needed to understand,
rework, and continue developing this app. Read this file fully before making changes.
A human-oriented handover also exists in `HANDOVER.md`.

---

## 1. What this app is

A **vanilla HTML/CSS/JavaScript Progressive Web App (PWA)** used by test engineers at
Accora who work with LINAK linear actuators (used in beds and rise/recline chairs).
It runs on phones (installed as a PWA from GitHub Pages) and on desktop browsers.

**There is NO build step, NO framework, NO Node.js, NO bundler.** Plain ES modules
loaded directly by the browser. Keep it that way unless the user explicitly asks for
a framework migration.

- **Repo:** https://github.com/Quantum-Nomad-88/linak-scanner
- **Live app:** https://quantum-nomad-88.github.io/linak-scanner/ (GitHub Pages, `main` branch, root)
- **Local dev:** `python -m http.server 8080` in the repo root, open http://localhost:8080
  (camera and OCR require HTTPS or localhost)

## 2. Features (by bottom-nav tab)

| Tab | What it does | Main files |
|-----|--------------|-----------|
| **Scan** | Photograph a LINAK actuator label, OCR it (Tesseract.js from CDN), decode the type code into specs (stroke, voltage, load, duty cycle, dimensions), save history, share results | `js/app.js`, `js/ocr.js`, `js/scan-frame.js`, `js/label-extract.js`, `js/decoders/*`, `js/history.js` |
| **Setup** | Guided test-setup wizard with mandatory photos; exports ZIP (Word report + JSON + photos); uploads to Supabase; lists/downloads team records | `js/test-setup-wizard.js`, `js/setup-export.js`, `js/setup-photos.js`, `js/cloud-sync.js`, `js/cloud-config.js` |
| **LA40** | LA40 actuator modification cut lengths + cycle time estimator | `js/la40-modifications.js` |
| **KA30** | KA30 actuator shortening calculator | `js/ka30-modifications.js` |
| **Bend** | Press-brake bar bending calculator with live SVG diagram | `js/bar-bending.js`, `js/bar-bending-diagram.js` |
| **Weights** | Bed/seat test weight distribution calculator (also feeds the wizard's Load step) | `js/weight-distribution.js` |

## 3. Architecture and conventions (IMPORTANT)

1. **Single-page app.** All views live in `index.html` as sibling `<section>` elements;
   `js/app.js` toggles visibility based on bottom-nav clicks. No router.
2. **ES modules.** Entry point is `js/app.js`, dynamically imported at the bottom of
   `index.html`. Modules import each other with relative paths.
3. **Cache-busting is manual.** `index.html` references `css/app.css?v=37` and
   `./js/app.js?v=47`. **Every time you change `app.css` or any JS reachable from
   `app.js`, bump these version numbers in `index.html`** or phone users will run
   stale code. This is the #1 source of "my change didn't work" confusion.
4. **Service worker (`sw.js`) caches ONLY icons** — deliberately. It previously
   cached HTML/JS and froze the app on updates. Do not add HTML/JS/CSS caching back.
5. **Storage:**
   - `localStorage` — scan history, saved cloud settings (URL/key/team code)
   - `sessionStorage` — wizard progress under key `linak_test_setup_wizard_v1`,
     **metadata only, never photo data URLs** (they blow the ~5 MB quota and were
     the cause of a corrupted-photos bug). Photos live in memory until export.
6. **External libraries, all CDN-loaded on demand:** Tesseract.js (OCR),
   JSZip (ZIP export), docx (Word report). No package.json.
7. **Style:** plain functions, small modules, no classes unless needed, UK English
   in UI copy ("colour"-style not enforced, but the audience is UK engineers).

## 4. The test setup wizard (core recent feature)

Defined in `js/test-setup-wizard.js` (~900 lines). Step order (the unofficial "QND"
step was deliberately REMOVED — do not re-add it):

1. `product` — Bed or chair
2. `test-type` — Type of test (options differ per product)
3. `cad` — CAD version
4. `actuators` — Actuators used (**photos required**)
5. `load` — Load applied; integrates with `weight-distribution.js` for bed/seat
   split (**photos required**)
6. `duty` — Duty cycle / motor cycle time + notes
7. `counters` — Counters applied + quantity (**photos required**)
8. `fan` — Cooling fan yes/no (photo only if yes)
9. `start` — Confirm testing started (**auto timestamp**)

Validation blocks Next until required fields/photos are present. On completion:
`js/setup-export.js` builds a ZIP (Word `.docx` report, `setup.json`, `photos/*.jpg`),
triggers a local download, and calls `js/cloud-sync.js` to upload to Supabase.

**Camera capture:** `js/setup-photos.js` — must `waitForVideoReady()` (checks
`videoWidth > 0`) before drawing to canvas, and converts to JPEG. The Scan tab
camera in `app.js` shows a **live visible `<video>` element** (a hidden 1×1 video
caused black frames on mobile — do not regress this).

## 5. Cloud sync (Supabase) — full picture

### Client side

- `js/cloud-config.js` — checked-in defaults: Supabase URL + publishable (anon) key
  are preloaded; `teamAccessCode` is empty until the user enters it in the app.
  Optional gitignored override file: `js/cloud-config.local.js`.
- `js/cloud-sync.js` — raw `fetch()` calls to Supabase REST + Storage APIs (no
  supabase-js SDK). Every request sends header `x-team-access: <team code>`.
  Handles: ZIP upload to bucket, insert into `setup_records`, list records,
  create signed download URLs (1 h expiry), the Cloud storage settings UI in the
  Setup tab, a first-run "Connect cloud storage" modal, and shareable
  **connection codes** (base64 blob of URL/key/team-code, also accepted via URL
  hash for one-tap device setup).

### Server side (Supabase project `awmwsatggebkiwqvqkfm`)

- Schema: `supabase/schema.sql` (idempotent; safe to re-run in SQL Editor).
  Creates:
  - table `public.setup_records` (metadata: file name/path, product, test type, timestamps)
  - schema `private` with `team_config` holding the team access code
  - function `check_team_access()` reading the `x-team-access` request header
  - RLS policies on `setup_records` and `storage.objects` gated by that function
    (insert/select allowed with valid code; **no delete/update policy** — audit trail)
- Storage bucket: **`test-setup-records`** — must be **private**; created manually
  in the dashboard (anon key cannot create buckets).
- Helper: `scripts/open-supabase-setup.ps1` copies the SQL to clipboard and opens
  the dashboard. A pre-filled `supabase/bootstrap-ready.sql` is gitignored.

### Credentials (operational — treat as shared team secrets)

- Supabase URL: `https://awmwsatggebkiwqvqkfm.supabase.co`
- Publishable/anon key: in `js/cloud-config.js` (committed; client-side by design;
  rotatable in the Supabase dashboard — if rotated, update `cloud-config.js` and bump cache version)
- **Team access code:** `gakd7PNRcyKZSQxYEeCr5Aof` (must match `private.team_config`
  in SQL and what users type into the app)
- **Never** commit or request the service-role key or database password.

### Verified working (as of handover)

SQL ran successfully; upload and table insert both returned HTTP 200 in testing.
A harmless leftover `records/healthcheck.txt` sits in the bucket (delete is blocked
by policy; removable via dashboard only).

## 6. Decoder subsystem (Scan tab)

`js/decoders/` parses OCR text from LINAK labels:

- `label-parser.js` — extracts fields (load, voltage, IP, duty, dates, W/O, item no.)
- `type-code.js` + `type-code-repair.js` — parse/repair the numeric type code
  (OCR often misreads digits; repair heuristics live here)
- `families.js` — per-family decode rules for 20+ actuator families (LA12…LA44, BB3, BL4)
- `dimensions.js` — built-in / fully-extended length formulas
- `engine.js` — orchestrates; `motor-catalog.js`, `plus-decode.js`, `constants.js` — data

If asked to add an actuator family, follow the existing pattern in `families.js`.

## 7. How to develop and test changes

1. Clone: `git clone https://github.com/Quantum-Nomad-88/linak-scanner.git`
2. Serve locally: `python -m http.server 8080` → http://localhost:8080
3. Make changes; **bump `?v=` numbers in `index.html`** for `app.css`/`app.js`
4. Test on a phone via GitHub Pages after pushing to `main` (Pages auto-deploys
   in 1–2 min), or via local network IP over HTTP (camera will NOT work over
   plain HTTP except localhost — use Gallery upload to test OCR instead)
5. Cloud testing: enter the team access code in Setup → Cloud storage, complete
   a wizard run, then check Setup → Server records on a second device/browser

There are **no automated tests** and no linter config. Manual browser testing only.

## 8. Known issues / gotchas (do not rediscover these the hard way)

1. **Stale code on phones** — almost always the `?v=` cache-bust not bumped, or
   the PWA needs a hard refresh/reinstall. Check this first when "nothing changed".
2. **Black camera preview** — regression risk: the video element must be visible
   and you must wait for `videoWidth > 0` before capturing. Fixed once already.
3. **sessionStorage quota** — never persist photo data URLs; metadata only.
4. **Anon key cannot do admin ops** — bucket creation and SQL must be done in the
   Supabase dashboard by a human; you cannot run SQL against Supabase from the app.
5. **Supabase SQL Editor warns "destructive operation"** — expected, the schema
   uses `drop policy if exists`; it is safe to re-run.
6. **iOS Safari quirks** — `getUserMedia` requires a user gesture; file inputs
   with `capture` behave differently; test both Camera and Gallery paths.
7. **`js/cloud-config.local.js` exists locally but is gitignored** — do not
   assume its presence in deployed environments.

## 9. Likely next tasks (backlog at time of handover)

- Rotate the Supabase publishable key (it was committed publicly) and update
  `cloud-config.js` + cache version
- End-to-end verify: phone upload → laptop download via Server records
- Delete `records/healthcheck.txt` from the bucket via dashboard (cosmetic)
- Possible future: search/filter for server records; PDF export; per-user
  attribution on uploads; admin delete flow

## 10. Rules for the AI developer

- Preserve the no-build vanilla-JS architecture unless explicitly told otherwise.
- Always bump `?v=` cache versions in `index.html` when shipping JS/CSS changes.
- Never re-add HTML/JS/CSS caching to `sw.js`.
- Never re-add the QND step to the wizard.
- Never store photo data URLs in sessionStorage.
- Never commit service-role keys, database passwords, or `cloud-config.local.js`.
- UI is mobile-first: test at ~375×667 viewport; content must clear the fixed
  bottom nav (`.main` has bottom padding for this — keep it).
- Commit style: short imperative sentence, e.g.
  "Improve mobile camera preview and streamline cloud connection setup."
