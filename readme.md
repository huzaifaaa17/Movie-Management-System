# NeonFlix Proxy (local dev)

This repository contains a small proxy backend (Express + SQLite) that serves the NeonFlix frontend and provides a simple API-backed store for demo data.

Quick summary
- Start the backend server and open the SPA at: http://localhost:3000
- Demo admin credentials (created on first run):
  - username: `adminhuzaifa`
  - password: `neonflix`
- The server preloads key nf_* data into browser localStorage so the existing SPA (which expects synchronous localStorage calls) continues to work without changing `app.js`.

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

Next recommended improvements (I can implement any of these for you)
- Add server-side seat validation (when admin marks a booking Paid) and atomic seat deduction to prevent overselling.
- Implement two-way sync: map client writes (bookings/watchlists) to DB endpoints and keep localStorage in sync.
- Improve auth: hash passwords, remove admin credentials from frontend, add sessions or JWT.
- Replace synchronous preload with an async storage abstraction in the frontend.p