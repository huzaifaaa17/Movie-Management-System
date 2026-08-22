# NeonFlix Proxy (local dev)

This repository contains a small proxy backend (Express + SQLite) that serves the NeonFlix frontend and provides a simple API-backed store for demo data.

Quick summary
- Start the backend server and open the SPA at: http://localhost:3000
- Demo admin credentials (created on first run) come from environment variables:
  - `ADMIN_USERNAME` (default: `adminhuzaifa`)
  - `ADMIN_PASSWORD` (default: `neonflix`)
  - Set your own values in a local `.env` file (not committed) or your shell before running the server. **Never commit real credentials.**
- All passwords (admin and user) are hashed with bcrypt before being stored — nothing is ever stored or transmitted in plaintext.
- Login and registration are verified entirely server-side (`/api/proxy/admin-login`, `/api/proxy/user-login`, `/api/proxy/register`) — the frontend never stores or checks credentials itself.
- The server preloads non-sensitive nf_* data (movies, seats, bookings, watchlists) into browser localStorage so the existing SPA (which expects synchronous localStorage calls) continues to work without changing `app.js`'s data-reading logic.
- `neonflix.db` is listed in `.gitignore` — it's generated locally on first run and should never be committed.

Prerequisites
- Node.js >= 18 (you already have v24.12.0 — good)
- npm (you have 11.6.2)

Files of interest
- `proxy_backend.js` — Express server + SQLite DB + localStorage preload injection
- `index.html`, `app.js`, `style.css` — frontend files served by the backend
- `neonflix.db` — SQLite DB file created automatically in the project root when the server runs
- `package.json` — scripts: `npm start` and `npm run dev` (if you install nodemon)

How to run (quick)
1. Install dependencies (you already did):
   npm install

2. Start server:
   npm start
   or (to run directly)
   node proxy_backend.js

3. Open the app in your browser:
   http://localhost:3000

What to expect on first run
- The server creates `neonflix.db` in the project folder, creates tables, inserts demo movies and the demo admin user.
- The server injects a small preload script into `index.html` that synchronously fetches data (nf_movieSeats, nf_users, nf_bookings_USERS, nf_watchlist_USERS, nf_movies) and writes them into browser localStorage before `app.js` runs.
- You can log in as admin (use the admin credentials above) and use the admin dashboard (Fix Data, mark Paid/Due, etc). You can also register regular users using the register form.

Useful development tips
- To enable automatic server restart on file changes:
  npm install -D nodemon
  npm run dev
- If port 3000 is in use, change `PORT` at the top of `proxy_backend.js` to another port (e.g. 3001) and open that port in your browser.

Testing the API (examples)
- Check health:
  curl http://localhost:3000/health
- Fetch preloaded seats:
  curl http://localhost:3000/api/proxy/nf_movieSeats
- Fetch bookings:
  curl http://localhost:3000/api/proxy/nf_bookings_USERS

Troubleshooting
- If the SPA shows blank or errors:
  - Check backend console output for errors.
  - Ensure `/override-localstorage.js` is being injected. Open the page source in the browser and verify the script tag near the head.
  - Confirm `neonflix.db` exists and the server printed creation messages.
- If you see CORS or network errors in the browser console, ensure you're loading from the same host/port (the server serves the frontend).
- If synchronous preload causes performance delay on slow networks, it's a pragmatic development fix; for production, we should replace synchronous preload with asynchronous API calls and update `app.js` to operate asynchronously.

Already fixed
- ✅ Passwords are hashed with bcrypt (no plaintext, client or server).
- ✅ Admin credentials removed from `app.js`; login goes through the backend API.
- ✅ Admin credentials configurable via `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars, not printed to logs in production.
- ✅ Backend's seeded movie catalog now matches the frontend's 13 movies exactly.
- ✅ `neonflix.db` is gitignored.

Still open (recommended next steps)
- Add server-side seat validation (when admin marks a booking Paid) and atomic seat deduction to prevent overselling.
- Implement two-way sync: map client writes (bookings/watchlists) to DB endpoints and keep localStorage in sync, instead of only reading from the DB on preload.
- Replace synchronous XHR preload with an async storage abstraction in the frontend (avoids blocking the main thread on load).
- Add sessions or JWT instead of re-checking credentials on every login call.
- Move off SQLite + ephemeral disk if deploying to Render's free tier long-term (use a managed Postgres instance for real persistence).