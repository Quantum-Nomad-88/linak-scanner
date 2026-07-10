# LINAK Actuator Toolkit — Handover Document

**Date:** July 2026  
**Repository:** [https://github.com/Quantum-Nomad-88/linak-scanner](https://github.com/Quantum-Nomad-88/linak-scanner)  
**Live app (GitHub Pages):** [https://quantum-nomad-88.github.io/linak-scanner/](https://quantum-nomad-88.github.io/linak-scanner/)

---

## 1. Purpose

Mobile-first **Progressive Web App (PWA)** for LINAK actuator work at Accora. Engineers use it on phones/tablets to:

- Scan actuator labels (OCR) and decode specifications
- Run guided **test setup** checklists with mandatory photos
- Upload completed setup records to **Supabase** for access from a PC
- Use calculators: LA40/KA30 mods, bar bending, bed/seat weight distribution

No build step — static HTML/JS served from GitHub Pages or any static host.

---

## 2. App sections (bottom navigation)

| Tab | Purpose |
|-----|---------|
| **Scan** | Camera/gallery OCR, type-code decode, share results |
| **Setup** | Cloud connection + guided test setup wizard + server record download |
| **LA40** | Component lengths and cycle time estimates |
| **KA30** | KA30 component cut lengths |
| **Bend** | Press brake calculator |
| **Weights** | Bed/seat test weight distribution |

---

## 3. Test setup wizard (main new workflow)

Sequential checklist (photos required at key steps):

1. Bed or chair  
2. Type of test  
3. CAD version  
4. Actuators used → **photos required**  
5. Load applied → weight distribution + scales + **photos required**  
6. Duty cycle / motor cycle time + notes  
7. Counters applied → qty + **photos required**  
8. Cooling fan (yes/no; photo if yes)  
9. Confirm testing started → **auto timestamp**

On completion the app:

- Saves a **ZIP** locally (Word report, JSON, individual JPGs in `photos/`)
- **Uploads** the ZIP to Supabase (if cloud is configured)
- Shows records under **Setup → Server records** on any device with the same team access code

**Removed from wizard:** unofficial QND step (per product request).

---

## 4. Cloud storage (Supabase)

### 4.1 Current status

| Item | Status |
|------|--------|
| Supabase project | `awmwsatggebkiwqvqkfm` |
| SQL schema (`supabase/schema.sql`) | **Run and verified** (table + RLS + storage policies) |
| Storage bucket `test-setup-records` | Must be **private** (not public) |
| Upload test | Verified HTTP 200 |
| List/download via app | Works with team access code |

### 4.2 Team access code (share with engineers)

```
gakd7PNRcyKZSQxYEeCr5Aof
```

This must match the value in Supabase SQL (`private.team_config`) and what users enter in the app.

### 4.3 How engineers connect (simple path)

1. Open the app → **Setup** tab  
2. Under **Cloud storage**, enter **only** the team access code above  
3. Tap **Save on this device**  
4. Status should show connected (URL and API key are **preloaded** in `js/cloud-config.js`)

**Alternative:** On first open, a **Connect cloud storage** modal may appear — paste the team code there and tap **Connect**.

**Advanced:** URL/key can be overridden under “Advanced” in Cloud storage (normally not needed).

### 4.4 Connection code (optional, for new devices)

On a device that is already configured:

1. Setup → Cloud storage → **Generate code** → **Copy code**  
2. On the new device: **Connect this device with a code** → paste → **Connect**

### 4.5 Downloading records on PC

1. Open the same GitHub Pages URL on a laptop  
2. Enter the same team access code and save  
3. Setup → **Server records** → **Refresh list** → **Download ZIP**

Files are private; downloads use **signed URLs** (expire after 1 hour).

---

## 5. Supabase admin (one-time / maintenance)

### 5.1 Dashboard links

- Project: `https://supabase.com/dashboard/project/awmwsatggebkiwqvqkfm`
- SQL Editor: run `supabase/schema.sql` (replace `YOUR_TEAM_ACCESS_CODE` before first run)
- Storage: bucket name **`test-setup-records`**, **private**

### 5.2 Re-run SQL script

Helper on Windows (copies SQL to clipboard, opens dashboard):

```powershell
powershell -ExecutionPolicy Bypass -File "scripts/open-supabase-setup.ps1"
```

Pre-filled SQL with the current team code (gitignored): `supabase/bootstrap-ready.sql`

### 5.3 S3 protocol

**Not required** for this app. The PWA uses Supabase REST + Storage APIs. S3 is only for external tools (backups, ETL).

---

## 6. Repository layout (key files)

```
linak-scanner/
  index.html              Main UI + all views
  css/app.css             Styles (mobile-first, bottom nav)
  js/app.js               Navigation, scan camera, boot logic
  js/test-setup-wizard.js Guided setup + photos + validation
  js/setup-export.js      ZIP/Word/JSON export + upload hook
  js/setup-photos.js      Camera capture helpers
  js/cloud-sync.js        Supabase upload, list, signed download, connect UI
  js/cloud-config.js      Default Supabase URL + publishable key (team code empty)
  js/cloud-config.local.js Gitignored local overrides (optional)
  js/weight-distribution.js  Bed/seat load split (used in setup wizard)
  supabase/schema.sql     Database + RLS + storage policies
  scripts/open-supabase-setup.ps1  Opens Supabase + copies SQL
  HANDOVER.md             This document
```

---

## 7. Deployment

### GitHub Pages

- Branch: **main**
- Source: root `/`
- After push, allow 1–2 minutes for Pages to update
- **Hard refresh** on phones after deploy (or reinstall PWA) to load new `app.js` / `css` cache-bust query params

### Local testing

```powershell
cd linak-scanner
python -m http.server 8080
```

Open `http://localhost:8080` (camera works on localhost).

---

## 8. Recent changes (commit history summary)

- Guided test setup wizard with required photos and weight calculator link  
- Cloud upload to Supabase with ZIP (report + photos + JSON)  
- Team access code security (RLS, private bucket, signed downloads)  
- Team-code-first onboarding (URL/key preloaded)  
- Camera preview fix (live video, not black screen)  
- Mobile layout fix (content not hidden behind bottom nav)  
- Connection code modal for device-to-device setup  

Latest commit on `main` at handover: see `git log -5`.

---

## 9. Testing checklist

- [ ] Open GitHub Pages URL on phone, add to home screen  
- [ ] Setup → enter team code → status shows connected  
- [ ] Complete a full test setup with photos on each required step  
- [ ] Confirm ZIP downloads / uploads without error toast  
- [ ] On PC: same URL, same team code, **Server records** shows entry and download works  
- [ ] Scan tab: camera preview visible (not black), capture works  
- [ ] Bottom buttons not cut off on small phone (e.g. iPhone SE)

---

## 10. Known limitations

- **Photos in sessionStorage:** Wizard metadata is saved without large photo blobs (quota). Photos stay in memory until setup completes; leaving mid-wizard may lose photos.  
- **Publishable key in repo:** `js/cloud-config.js` contains the Supabase URL and publishable key for ease of use. Anyone with the team code can upload/list per RLS. Consider rotating the key in Supabase if the repo or chat history was widely shared.  
- **No delete policy on storage:** Test files remain until removed in Supabase dashboard (by design for audit trail).  
- **Service worker:** Caches icons only; bump `sw.js` / cache version if caching issues after updates.  
- **OCR:** Requires HTTPS (GitHub Pages OK) or localhost.

---

## 11. Troubleshooting

| Problem | What to check |
|---------|----------------|
| “Cloud upload not configured” | Team access code entered and saved; spelling matches SQL |
| Upload fails 401/403 | Team code wrong; or SQL/policies not applied |
| No records in list | Complete a setup after connecting; tap Refresh |
| Camera black screen | Hard refresh; use Gallery if camera fails; ensure HTTPS |
| Old UI after push | Clear site data / reinstall PWA; check Pages deployed from `main` |
| SQL warnings in Supabase | “Destructive” = normal (`drop policy if exists`); enable RLS on `team_config` if prompted |

---

## 12. Security recommendations (for maintainers)

1. **Rotate** Supabase publishable key if it was exposed in git/chat; update `js/cloud-config.js` and have users re-save or use connection code.  
2. Keep storage bucket **private**.  
3. Do not commit `cloud-config.local.js` or real service-role keys.  
4. Team access code is the gate for anon API access — treat like a shared team password; rotate in SQL + app if leaked.  
5. Optional: move URL/key to GitHub Pages secrets / build inject later if stricter separation is needed (not implemented today).

---

## 13. Contacts / ownership

| Role | Detail |
|------|--------|
| GitHub org/user | `Quantum-Nomad-88` |
| Supabase project ref | `awmwsatggebkiwqvqkfm` |
| Handover prepared by | Development session (Cursor), July 2026 |

---

## 14. Quick start for the next developer

```bash
git clone https://github.com/Quantum-Nomad-88/linak-scanner.git
cd linak-scanner
# Edit js/cloud-config.js only if changing Supabase project or key
# Push to main → GitHub Pages auto-deploys
```

**For a new Supabase project:** run `supabase/schema.sql`, create private bucket `test-setup-records`, update `cloud-config.js`, distribute new team access code to engineers.

---

*End of handover document.*
