# QRLink — Supabase-only starter

Vanilla HTML/CSS/JavaScript + Supabase + Vercel. This build requires Supabase — there
is no offline/local-storage demo mode, so every card is a real row in your database and
every QR/profile link works from any device.

## Setup (required)
1. Create a free project at https://supabase.com
2. Open the SQL Editor and run `supabase/schema.sql`
3. In your Supabase project settings, copy the **Project URL** and the **anon / publishable key**
4. Paste both into `config.js`:
   ```js
   window.QRLINK_CONFIG={SUPABASE_URL:'https://YOUR_PROJECT.supabase.co',SUPABASE_ANON_KEY:'YOUR_ANON_KEY'};
   ```
5. Never put a `service_role` key in `config.js` — it ships to every visitor's browser.
6. Open `create.html`. The badge in the top right should read **"Supabase connected"**.
   If it reads "Supabase not connected", re-check step 3–4 and your internet connection.
7. Push this folder to GitHub and import it into Vercel. No build command is required.

## What was fixed
- `create.html` and `card.html` never loaded the Supabase JS client library, so
  `window.supabase` was always `undefined` and the app silently fell back to
  browser localStorage no matter what was in `config.js`. Added the missing
  `@supabase/supabase-js` script tag to both pages.
- The app used to fail *silently* into a local-only demo mode with no visible
  error. It now requires Supabase to be configured, disables the create button,
  and shows a clear on-page message if the library fails to load or the
  credentials are missing.
- `SUPABASE_URL` is now normalized in code, so accidentally pasting the
  REST/Auth/Storage endpoint line (e.g. ending in `/rest/v1` or `/storage/v1`)
  instead of the bare Project URL no longer breaks every request with
  "Invalid path specified in request URL".
- The `qrcode` npm package (1.5.2 and up, including the 1.5.4 this project
  originally pinned) stopped shipping its browser bundle, so
  `cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js` 404s and `QRCode` was
  never defined. Replaced it with `assets/qrcode.min.js` — a small, dependency-free,
  MIT-licensed QR library (davidshimjs/qrcodejs) vendored locally, so QR
  generation no longer depends on any external CDN at all.
- Bumped the service worker cache version so returning visitors get the fixed
  files instead of a cached broken copy.

## Architecture
Frontend: static HTML/CSS/JS. Hosting: Vercel. Data: Supabase Postgres. Images: Supabase Storage. QR: local `assets/qrcode.min.js` (no external CDN dependency).

## Important
The prototype insert/storage policies in `supabase/schema.sql` are public so anyone can
create a card without signing in. For a real public product, add Supabase Auth, per-user
RLS, rate limiting, upload restrictions, and abuse protection.
