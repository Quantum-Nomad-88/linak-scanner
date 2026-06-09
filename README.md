# LINAK Motor Specs

Scan LINAK actuator labels with your phone and decode motor specifications.

## Features

- Camera or gallery image scan (OCR)
- Manual text paste / edit
- Decodes **20+ common actuator families**: LA12, LA18, LA20, LA22, LA23, LA25, LA27, LA28, LA29, LA30, LA31, LA32, LA34, LA35, LA36, LA40, LA42, LA43, LA44, BB3, BL4
- Reads label fields: stroke, voltage, load, duty cycle, IP, W/O serial, production date
- Calculates built-in and fully extended dimensions (where formulas exist)
- Save scan history (offline, on device)
- Installable as a phone app (PWA)

## Install on your phone

### Option 1 — Local network (fastest)

1. On your PC, open a terminal in this folder and run:

   ```powershell
   python -m http.server 8080
   ```

2. Find your PC's local IP (e.g. `192.168.1.50`).
3. On your phone (same Wi‑Fi), open: `http://192.168.1.50:8080`
4. **Android:** Chrome menu → "Add to Home screen" / "Install app"
5. **iPhone:** Safari Share → "Add to Home Screen"

### Option 2 — GitHub Pages (recommended)

After pushing this repo to GitHub:

1. Go to **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **/ (root)**
4. Save — your app will be at `https://YOUR-USERNAME.github.io/linak-scanner/`

Open that URL on your phone and **Add to Home Screen**. HTTPS is included, so the camera works.

### Option 3 — Other static hosts

Upload to Netlify, Cloudflare Pages, etc.

> Camera requires **HTTPS** or **localhost**.

## How to use

1. Open the app → **Scan**
2. Tap **Camera** or **Gallery** and photograph the LINAK label
3. Check/edit the OCR text if needed
4. Tap **Decode specs**
5. **Save** to history or **Share** results

If OCR misses the type code, type it in the **Type code override** field (e.g. `311100-00100240`).

## What it decodes

| Source | Fields |
|--------|--------|
| Label OCR | Max load, voltage, current, duty cycle, IP, prod date, W/O #, item no. |
| Type code | Stroke, spindle pitch, feedback, motor variant, brake (model-dependent) |
| Calculated | Built-in length, fully extended length |

Custom or special-order actuators may need manual verification. For exact factory config, use the W/O number with LINAK's datasheet lookup: https://www.linak.com/products/data-sheet-config/

## Folder structure

```
linak-scanner/
  index.html          Main app
  css/app.css         Styles
  js/app.js           UI logic
  js/ocr.js           Tesseract OCR
  js/history.js       Local storage
  js/decoders/        Label parser + actuator decoders
  manifest.webmanifest  PWA install manifest
  sw.js               Offline cache
```

## No build step required

Pure HTML/JS — no Node or Flutter needed. OCR uses Tesseract.js (loaded from CDN on first use, then cached).
