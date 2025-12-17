// NeonFlix - app.js
// Single-file SPA controller for the NeonFlix demo app
// This version includes booking normalization utilities and a "Fix Data" admin action.
// Key behavior:
// - Unpaid bookings (paid: false) do NOT reduce seats.
// - Seats are recomputed only from PAID bookings (recomputeSeatsFromPaidBookings).
// - Bookings are normalized (merged per user/movie/timing) by normalizeBookings.
// - Admin can toggle Paid/Due per booking; toggling recomputes seats from all paid bookings.
// - Admin panel exposes a "Fix Data" button which runs normalization + recompute.
// - Users are informed of the 80% refund policy and ticket pickup instructions.


// ====================== Constants & Demo Admin =======================
const ADMIN_USERNAME = "adminhuzaifa";
const ADMIN_PASSWORD = "neonflix";
let loginRole = null; // "admin" or "user"
let user = null;      // { email, admin: boolean }

// === Movie Showtimes/Seats Constants ===
const MOVIE_TIMINGS = ["9:00 AM", "12:00 PM", "3:00 PM", "6:00 PM", "9:00 PM"];
const SEATS_TOTAL = 60;

// ===================== Demo Movie Database ===========================
function enrichMovie(m) {
  if (!m.timings) m.timings = [...MOVIE_TIMINGS];
  if (!m.seats) m.seats = Array(m.timings.length).fill(SEATS_TOTAL);
  return m;
}
const MOVIES = [
  { title: "Barbie", poster: "https://image.tmdb.org/t/p/w780/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg", year:2023, rating:7.0, genre:"Comedy", language:"English", duration:114, actors:["Margot Robbie", "Ryan Gosling", "America Ferrera"], desc:"Barbie and Ken explore the real world in a pastel adventure." },
  { title: "Killers of the Flower Moon", poster: "https://image.tmdb.org/t/p/w780/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg", year:2023, rating:7.5, genre:"Drama", language:"English", duration:206, actors:["Leonardo DiCaprio", "Robert De Niro", "Lily Gladstone"], desc:"Osage murders spark an FBI investigation in 1920s Oklahoma." },
  { title: "John Wick: Chapter 4", poster: "https://image.tmdb.org/t/p/w780/2lUYbD2C3XSuwqMUbDVDQuz9mqz.jpg", year:2023, rating:7.7, genre:"Action", language:"English", duration:169, actors:["Keanu Reeves", "Donnie Yen", "Bill Skarsgård"], desc:"John Wick faces deadly foes as the bounty rises." },
  { title: "Spider-Man: Across the Spider-Verse", poster: "https://image.tmdb.org/t/p/w780/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg", year:2023, rating:8.6, genre:"Animation", language:"English", duration:140, actors:["Shameik Moore", "Hailee Steinfeld", "Oscar Isaac"], desc:"Miles Morales journeys through the Multiverse." },
  { title: "Guardians of the Galaxy Vol. 3", poster: "https://image.tmdb.org/t/p/w780/r2J02Z2OpNTctfOSN1Ydgii51I3.jpg", year:2023, rating:7.9, genre:"Sci-Fi", language:"English", duration:150, actors:["Chris Pratt", "Zoe Saldaña", "Dave Bautista"], desc:"The Guardians reunite for one last mission." },
  { title: "The Marvels", poster: "", year:2023, rating:6.1, genre:"Action", language:"English", duration:105, actors:["Brie Larson", "Teyonah Parris", "Iman Vellani"], desc:"Marvel heroes unite as their powers tangle." },
  { title: "Wonka", poster: "https://image.tmdb.org/t/p/w780/qhb1qOilapbapxWQn9jtRCMwXJF.jpg", year:2023, rating:7.2, genre:"Family", language:"English", duration:117, actors:["Timothée Chalamet", "Olivia Colman", "Keegan-Michael Key"], desc:"Young Willy Wonka invents iconic treats and meets Oompa-Loompas." },
  { title: "The Super Mario Bros. Movie", poster: "https://image.tmdb.org/t/p/w780/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg", year:2023, rating:7.1, genre:"Animation", language:"English", duration:92, actors:["Chris Pratt", "Anya Taylor-Joy", "Keegan-Michael Key"], desc:"Mario and Luigi journey through the Mushroom Kingdom." },
  { title: "Mission: Impossible – Dead Reckoning Part One", poster: "https://image.tmdb.org/t/p/w780/NNxYkU70HPurnNCSiCjYAmacwm.jpg", year:2023, rating:7.8, genre:"Thriller", language:"English", duration:163, actors:["Tom Cruise", "Hayley Atwell", "Rebecca Ferguson"], desc:"Ethan Hunt faces a mysterious AI across the globe." },
  { title: "The Fall Guy", poster: "https://image.tmdb.org/t/p/w780/aTvePCU7exLepwg5hWySjwxojQK.jpg", year:2024, rating:7.3, genre:"Action", language:"English", duration:126, actors:["Ryan Gosling", "Emily Blunt", "Aaron Taylor-Johnson"], desc:"A stuntman is drawn into a wild conspiracy." },
  { title: "Kung Fu Panda 4", poster: "https://image.tmdb.org/t/p/w780/sRLC052ieEzkQs9dEtPMfFxYkej.jpg", year:2024, rating:7.0, genre:"Animation", language:"English", duration:94, actors:["Jack Black", "Awkwafina", "Bryan Cranston"], desc:"Po confronts a new villain as he trains the next Dragon Warrior." },
  { title: "Elemental", poster: "https://image.tmdb.org/t/p/w780/4Y1WNkd88JXmGfhtWR7dmDAo1T2.jpg", year:2023, rating:7.0, genre:"Animation", language:"English", duration:102, actors:["Leah Lewis", "Mamoudou Athie", "Ronnie del Carmen"], desc:"Fire and water discover all they have in common." },
  { title: "The Hunger Games: The Ballad of Songbirds & Snakes", poster: "https://image.tmdb.org/t/p/w780/mBaXZ95R2OxueZhvQbcEWy2DqyO.jpg", year:2023, rating:7.2, genre:"Action", language:"English", duration:157, actors:["Rachel Zegler", "Tom Blyth", "Viola Davis"], desc:"Coriolanus Snow's story in the 10th Hunger Games." }
].map(enrichMovie);

// derived genres
const GENRES = [...new Set(MOVIES.map(m => m.genre))];

// initialize seats in localStorage if not present
if (!localStorage.getItem("nf_movieSeats")) {
  localStorage.setItem("nf_movieSeats", JSON.stringify(MOVIES.map(m => Array(m.timings.length).fill(SEATS_TOTAL))));
}

// UI state
let page = "login";
let selectedId = null;
let filterObj = {};
let filterSearch = "";
let watchlist = JSON.parse(localStorage.getItem("nf_watchlist") || "[]");

// =================== User Auth Emulation Helpers =====================
function getUsers() {
  return JSON.parse(localStorage.getItem("nf_users") || "[]");
}
function saveUsers(users) {
  localStorage.setItem("nf_users", JSON.stringify(users));
}

// ============================== ROUTER ===============================
function goto(p, arg) {
  // Protect routes requiring login
  if (!user && p !== "login" && p !== "register") {
    page = "login"; render(); return;
  }
  if      (p === "home")      { page = "home"; selectedId = null; render(); }
  else if (p === "movie")     { page = "movie"; selectedId = arg; render(); }
  else if (p === "watchlist") { page = "watchlist"; render(); }
  else if (p === "profile")   { page = "profile"; render(); }
  else if (p === "login")     { page = "login"; render(); }
  else if (p === "register")  { page = "register"; render(); }
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelectorAll(".navbar nav a").forEach(e => e.classList.remove("active"));
  const n = { home: "nav-home", watchlist: "nav-watchlist", profile: "nav-profile" }[page];
  if (n) {
    const el = document.getElementById(n);
    if (el) el.classList.add("active");
  }
}

// ============ ROLE SELECTION / LOGIN / REGISTER UI ==================
function roleSelectPage() {
  return `<section class="section" style="max-width:370px;margin:70px auto;padding:38px 25px 45px 25px;border-radius:22px;background:linear-gradient(99deg,#191225 60%,#2a1931 100%);box-shadow:0 2.2px 33px #0df3e462;text-align:center;">
    <h2>NeonFlix Login</h2>
    <div style="margin:1.5em 0;">
      <button onclick="setRole('user')" style="padding:.8em 2.2em;font-size:1.09em;font-family:inherit;border-radius:22px;background:var(--neon);color:#fff;font-weight:700;border:none;letter-spacing:.02em;margin:0.5em 0.9em;">User</button>
      <button onclick="setRole('admin')" style="padding:.8em 2.2em;font-size:1.09em;font-family:inherit;border-radius:22px;background:var(--neon);color:#fff;font-weight:700;border:none;letter-spacing:.02em;margin:0.5em 0.9em;">Admin</button>
    </div>
    <div id="choose-error" style="color:#ff18a6;margin-top:1em;"></div>
  </section>`;
}
window.setRole = function(role) { loginRole = role; render(); };

function loginPage() {
  // Show role select if role not chosen yet
  if (!loginRole) return roleSelectPage();

  if(loginRole==="admin") {
    return `<section class="section" style="max-width:380px;margin:70px auto;padding:38px 25px 60px 25px;border-radius:22px;background:linear-gradient(99deg,#191225 60%,#2a1931 100%);box-shadow:0 2.2px 33px #0df3e462;">
      <h2>Admin Login</h2>
      <form id="adminLoginForm" autocomplete="off">
        <input name="adminname" type="text" required placeholder="Admin Name" style="width:100%;font-size:1.15em;padding:.8em;margin:18px 0;">
        <input name="password" type="password" required placeholder="Password" style="width:100%;font-size:1.15em;padding:.8em;margin:18px 0;">
        <button style="padding:.90em 1.34em;font-size:1.11em;font-family:inherit;border-radius:22px;background:var(--neon);color:#fff;font-weight:700;border:none;letter-spacing:.01em;" type="submit">Login as Admin</button>
      </form>
      <div style="text-align:center;margin-top:18px;">
        <button onclick="resetLogin()" style="background:transparent;border:none;color:#1cffce;font-weight:700;cursor:pointer;text-decoration:underline;font-size:1em;">Back</button>
      </div>
      <div id="login-error" style="color:#ff18a6;text-align:center;margin-top:14px;"></div>
    </section>`;
  } else {
    return `<section class="section" style="max-width:380px;margin:70px auto;padding:38px 25px 60px 25px;border-radius:22px;background:linear-gradient(99deg,#191225 60%,#2a1931 100%);box-shadow:0 2.2px 33px #0df3e462;">
      <h2>User Login</h2>
      <form id="loginForm" autocomplete="off">
        <input name="email" type="email" required placeholder="Email" style="width:100%;font-size:1.15em;padding:.8em;margin:18px 0;">
        <input name="password" type="password" required placeholder="Password" style="width:100%;font-size:1.15em;padding:.8em;margin:18px 0;">
        <button style="padding:.90em 1.34em;font-size:1.11em;font-family:inherit;border-radius:22px;background:var(--neon);color:#fff;font-weight:700;border:none;letter-spacing:.01em;" type="submit">Login as User</button>
      </form>
      <div style="text-align:center;margin-top:18px;">
        <span style="color:#baffc7;">Don't have an account?</span>
        <button onclick="goto('register')" style="background:transparent;border:none;color:#1cffce;font-weight:700;cursor:pointer;text-decoration:underline;font-size:1em;">Register</button>
        <button onclick="resetLogin()" style="background:transparent;border:none;color:#1cffce;font-weight:700;cursor:pointer;text-decoration:underline;font-size:1em;margin-left:1.5em;">Back</button>
      </div>
      <div id="login-error" style="color:#ff18a6;text-align:center;margin-top:14px;"></div>
    </section>`;
  }
}
function resetLogin() { loginRole = null; page = "login"; render(); }

function registerPage() {
  return `<section class="section" style="max-width:380px;margin:70px auto;padding:38px 25px 60px 25px;border-radius:22px;background:linear-gradient(99deg,#191225 60%,#2a1931 100%);box-shadow:0 2.2px 33px #0df3e462;">
    <h2>Create Account</h2>
    <form id="regForm" autocomplete="off">
      <input name="email" type="email" required placeholder="Email" style="width:100%;font-size:1.15em;padding:.8em;margin:18px 0;">
      <input name="password" type="password" required minlength="4" placeholder="Password" style="width:100%;font-size:1.15em;padding:.8em;margin:18px 0;">
      <button style="padding:.90em 1.34em;font-size:1.11em;font-family:inherit;border-radius:22px;background:var(--neon);color:#fff;font-weight:700;border:none;letter-spacing:.01em;" type="submit">Register</button>
    </form>
    <div style="text-align:center;margin-top:18px;">
      <button onclick="goto('login')" style="background:transparent;border:none;color:#1cffce;font-weight:700;cursor:pointer;text-decoration:underline;font-size:1em;">Back to login</button>
    </div>
    <div id="reg-error" style="color:#ff18a6;text-align:center;margin-top:14px;"></div>
  </section>`;
}

// ========================= MAIN RENDER ==============================
function render() {
  // ROUTE main SPA page
  const appEl = document.getElementById("app");
  if (!appEl) {
    console.warn("app root (#app) missing. render() aborted.");
    return;
  }

  appEl.innerHTML =
    page === "home"      ? pageHome()
    : page === "movie"   ? pageMovie()
    : page === "watchlist" ? pageWatchlist()
    : page === "profile" ? pageProfile()
    : page === "login"   ? loginPage()
    : page === "register"? registerPage()
    : "<div>404</div>";

  // ---- NAV SEARCH BAR ----
  let navSearch = document.getElementById("search-input");
  if(navSearch){
    navSearch.value = filterSearch || '';
    navSearch.oninput = function(e){
      filterSearch = e.target.value;
      render(); // live update grid on typing
    };
  }

  // ---- Dropdowns for filtering (genre/year/rating) ----
  let fg = document.getElementById("grid-filter-genre");
  if(fg) fg.onchange = e=>(filterObj.genre=e.target.value||undefined, render());
  let fy = document.getElementById("grid-filter-year");
  if(fy) fy.onchange = e=>(filterObj.year=e.target.value||undefined, render());
  let fr = document.getElementById("grid-filter-rating");
  if(fr) fr.onchange = e=>(filterObj.rating=e.target.value||undefined, render());

  // ---- Admin add movie form ----
  let addForm = document.getElementById('addForm');
  if(addForm && user && user.admin) {
    addForm.onsubmit = function(e){
      e.preventDefault();
      let f = Object.fromEntries(new FormData(addForm).entries());
      f.actors = f.actors.split(",").map(x=>x.trim());
      f.year = +f.year; f.rating=+f.rating; f.duration=+f.duration;
      f.timings = [...MOVIE_TIMINGS];
      f.seats = Array(MOVIE_TIMINGS.length).fill(SEATS_TOTAL);
      MOVIES.push(enrichMovie(f));
      let allSeats = JSON.parse(localStorage.getItem('nf_movieSeats') || '[]');
      allSeats.push([...f.seats]);
      localStorage.setItem('nf_movieSeats', JSON.stringify(allSeats));
      render();
    };
  }

  // Attach auth handlers for forms that may have been rendered
  if (typeof window.attachAuthHandlers === 'function') window.attachAuthHandlers();
}

// expose goto globally
window.goto = goto;

// ================== Booking normalization & seat recompute ==================

// Recompute seat availability only from currently PAID bookings.
// This avoids incremental double-counts and keeps nf_movieSeats consistent.
function recomputeSeatsFromPaidBookings() {
  const seats = MOVIES.map(m => Array(m.timings.length).fill(SEATS_TOTAL));
  const bookings = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');

  Object.values(bookings).forEach(arr => {
    (arr || []).forEach(entry => {
      if (entry && entry.paid) {
        seats[entry.movieIdx] = seats[entry.movieIdx] || Array(MOVIE_TIMINGS.length).fill(SEATS_TOTAL);
        const idx = entry.timingIdx;
        seats[entry.movieIdx][idx] = (seats[entry.movieIdx][idx] || SEATS_TOTAL) - (entry.count || 0);
        if (seats[entry.movieIdx][idx] < 0) seats[entry.movieIdx][idx] = 0;
      }
    });
  });

  localStorage.setItem("nf_movieSeats", JSON.stringify(seats));
}

// Normalize bookings: merge multiple entries for same user/movie/timing into one.
// If any merged piece was paid, the merged entry.paid becomes true.
function normalizeBookings() {
  const raw = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');
  const merged = {};

  Object.entries(raw).forEach(([email, arr]) => {
    merged[email] = [];
    const map = {}; // key -> merged entry
    (arr || []).forEach(e => {
      const key = `${e.movieIdx}_${e.timingIdx}`;
      if (!map[key]) {
        map[key] = {
          movieIdx: e.movieIdx,
          timingIdx: e.timingIdx,
          count: 0,
          bookedAt: e.bookedAt || new Date().toISOString(),
          paid: false
        };
      }
      map[key].count += (e.count || 1);
      if (e.paid) map[key].paid = true; // if any was paid, mark paid
      // keep the earliest bookedAt
      if (e.bookedAt && new Date(e.bookedAt) < new Date(map[key].bookedAt)) map[key].bookedAt = e.bookedAt;
    });
    merged[email] = Object.values(map);
  });

  localStorage.setItem("nf_bookings_USERS", JSON.stringify(merged));
  // rebuild seats from paid bookings
  recomputeSeatsFromPaidBookings();
  // refresh UI
  render();
}

// Admin convenience: fix data button handler
window.adminFixData = function() {
  if (!user || !user.admin) { alert("Only admins can run this."); return; }
  normalizeBookings();
  alert("Bookings normalized and seat availability recomputed.");
};

// ================== Main SPA Page Functions & Panels ===================

// --- Filter Bar ---
function filterBar() {
  return `<div class="filterbar-glow">
      <select id="grid-filter-genre"><option value="">🎬 Genre</option>${
        GENRES.map(g=>`<option${filterObj.genre===g?" selected":""}>${escapeHtml(g)}</option>`).join('')
      }</select>
      <select id="grid-filter-year"><option value="">📅 Year</option>${
        Array.from(new Set(MOVIES.map(m=>m.year))).sort((a,b)=>b-a)
          .map(y=>`<option${filterObj.year==y?" selected":""}>${y}</option>`).join('')
      }</select>
      <select id="grid-filter-rating"><option value="">⭐ Min</option>${
        [9,8,7,6,5].map(r=>`<option${filterObj.rating==r?" selected":""}>${r}</option>`).join('')
      }</select>
      <button class="filter-clear neon-glow" onclick="clearGridFilters()">✖</button>
    </div>`;
}
window.clearGridFilters = function(){
  filterObj = {}; filterSearch = ""; render();
};

// --- Main Page: Home (movie grid) ---
function pageHome() {
  let seatsAll = JSON.parse(localStorage.getItem("nf_movieSeats") || "[]");
  // ensure seatsAll consistent
  if (!Array.isArray(seatsAll) || seatsAll.length !== MOVIES.length) {
    seatsAll = MOVIES.map(m => Array(m.timings.length).fill(SEATS_TOTAL));
    localStorage.setItem("nf_movieSeats", JSON.stringify(seatsAll));
  }

  let grid = MOVIES.map((m,i)=>({...m,index:i}))
    .filter(m=>
      (!filterObj.genre || m.genre===filterObj.genre) &&
      (!filterObj.year || m.year == filterObj.year) &&
      (!filterObj.rating || Math.floor(m.rating) >= filterObj.rating) &&
      (!filterSearch || m.title.toLowerCase().includes(filterSearch.toLowerCase()) ||
        m.actors.join(",").toLowerCase().includes(filterSearch.toLowerCase()))
    );
  return `
  <section class="section">
    <h1 class="grid-title" style="font-size:2.05em;background:linear-gradient(90deg,#ff18a6 13%,#1cffce 70%);color:transparent;-webkit-background-clip:text;background-clip:text;letter-spacing:.03em;margin-bottom:.9em;">🔥 Trending Movies</h1>
    ${filterBar()}
    <div class="grid-movies" id="grid-movies">
      ${
        grid.map(m=>`
        <div class="movie-card">
          <div class="poster-wrap" onclick="goto('movie',${m.index})" style="cursor:pointer;">
            <span class="card-gradient"></span>
            <img class="poster" src="${m.poster || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format=compress&w=400&q=80'}" alt="${escapeHtml(m.title)} Poster"
              onerror="posterFallback(this)"/>
          </div>
          <div class="card-infos">
            <div class="card-title">${escapeHtml(m.title)}</div>
            <div class="card-rating"><span>★</span> ${m.rating}</div>
            <div class="card-meta">${m.year} · ${escapeHtml(m.genre)}</div>
            <div style="color:#ffeab4;margin-bottom:3px;">Showtimes: <span style="color:#bbffea;">${m.timings.join(', ')}</span></div>
            <div class="card-actors">${m.actors.slice(0,2).map(a=>escapeHtml(a)).join(", ")}${m.actors.length>2?",...":""}</div>
          </div>
          ${user && user.admin ?
            `<button class="edit-btn neon" onclick="editMovie(${m.index});event.stopPropagation();">✎ Edit</button>
             <button class="del-btn" onclick="delMovie(${m.index});event.stopPropagation();">🗑</button>`:""
          }
        </div>
        `).join('')
      }
    </div>
      ${user && user.admin ? adminPanel() : ""}
      ${user && user.admin ? adminSeatsPanel() : ""}
      ${user && user.admin ? adminUserBookingsPanel() : ""}
  </section>`;
}

// --- Movie Details Page ---
function pageMovie() {
  const m = MOVIES[selectedId], idx = selectedId;
  if (!m) return `<section class="section"><div style="color:#f55;text-align:center;padding:2em;">Movie not found.</div></section>`;
  const seatsArr = JSON.parse(localStorage.getItem("nf_movieSeats") || '[]')[idx] || Array(m.timings.length).fill(SEATS_TOTAL);
  return `<section class="section">
    <div class="details-page">
      <div class="details-poster">
        <img src="${m.poster || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format=compress&w=400&q=80'}" alt="" onerror="posterFallback(this)"/>
        <div class="poster-glow"></div>
      </div>
      <div class="details-summary">
        <div class="details-title">${escapeHtml(m.title)}</div>
        <div class="details-rating">★ ${m.rating} <span class="details-genre">${escapeHtml(m.genre)}</span></div>
        <div class="details-meta">
          <b>Language:</b> ${escapeHtml(m.language)} &nbsp;|&nbsp; <b>Year:</b> ${m.year} &nbsp;|&nbsp; 
          <b>Duration:</b> ${Math.floor(m.duration/60)}h${("0"+m.duration%60).slice(-2)}m
        </div>
        <div style="margin:10px 0;"><b>Available Showtimes:</b>
          <ul style="list-style:none;padding:0;margin:0;">
            ${m.timings.map((time, tIdx) => {
              const seatsLeft = (seatsArr && seatsArr[tIdx] !== undefined) ? seatsArr[tIdx] : SEATS_TOTAL;
              return `<li style="margin-bottom:6px;">
                <span>${time}</span>
                <span style="color:#9affea;"> (${seatsLeft} seat${seatsLeft!==1?"s":""} left)</span>
                ${
                  (user && !user.admin && seatsLeft>0)
                    ? `<button onclick="bookSeat(${idx},${tIdx});event.stopPropagation();" style="margin-left:9px;padding:5px 16px;border-radius:14px;font-weight:600;background:var(--neon);border:none;color:#fff;cursor:pointer;box-shadow:0 3px 14px #1cffce99;">Book</button>`
                    : (seatsLeft>0 ? `` : `<span style="color:#ff14a3;font-weight:700;margin-left:10px;">Booked</span>`)
                }
                <span style="font-size:.98em;">• <b>Total capacity: 60 seats</b></span>
              </li>`;
            }).join("")}
          </ul>
        </div>
        <div class="details-actors"><b>Cast:</b> ${m.actors.map(a=>escapeHtml(a)).join(", ")}</div>
        <div class="details-desc">${escapeHtml(m.desc)}</div>
        ${
          user && !user.admin ? 
          `<button class="details-watchlist-btn${getUserWatchlist(user.email).includes(idx)?' on':''}" onclick="toggleWatchlist(${idx});event.stopPropagation()">
            ${getUserWatchlist(user.email).includes(idx) ? "− Remove from" : "＋ Add to"} Watchlist
          </button>`
          : ""
        }
        ${user && user.admin?`
          <button class="edit-btn neon" onclick="editMovie(${idx});event.stopPropagation();">✎ Edit Movie</button>
          <button class="del-btn" onclick="delMovie(${idx});event.stopPropagation();">🗑 Delete Movie</button>
         `:""}
      </div>
    </div>
  </section>`;
}

// --- Watchlist Page ---
function pageWatchlist() {
  if (user && user.admin) {
    // Admin: show a friendly info message instead of a list/grid
    return `<section class="section" style="text-align:center;margin-top:3em;">
      <div style="font-size:1.4em;color:#fd18a6;font-weight:700;">
        ADMINS DO NOT HAVE A WATCHLIST!
      </div>
    </section>`;
  }
  const wl = getUserWatchlist(user.email);
  if(!wl || !wl.length)
    return `<section class="section"><div class="watchlist-empty">📝 Your watchlist is empty, Add movies to see your watchlist!</div></section>`;
  return `<section class="section">
    <h1 style="font-size:1.7em;margin-bottom:20px;background:linear-gradient(90deg,#ff18a6 13%,#1cffce 80%);color:transparent;-webkit-background-clip:text;background-clip:text;">👀 Your Watchlist</h1>
    <div class="watchlist-grid">
    ${wl.map(i=>`
      <div class="movie-card" onclick="goto('movie',${i})" style="cursor:pointer;">
        <div class="poster-wrap">
          <span class="card-gradient"></span>
          <img class="poster" src="${MOVIES[i].poster || 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format=compress&w=400&q=80'}"
          alt="${escapeHtml(MOVIES[i].title)}" onerror="posterFallback(this)"/>
        </div>
        <div class="card-infos">
          <div class="card-title">${escapeHtml(MOVIES[i].title)}</div>
          <div class="card-rating"><span>★</span> ${MOVIES[i].rating}</div>
          <div class="card-meta">${MOVIES[i].year} · ${escapeHtml(MOVIES[i].genre)}</div>
        </div>
      </div>
    `).join("")}
    </div>
  </section>`;
}

// --- Profile Page ---
function pageProfile() {
  // inside pageProfile(), at the very start:
if (!user) {
  const email = localStorage.getItem("nf_email");
  if (email) {
    user = { email, admin: email === "admin@neonflix.com" };
  }
}
  // Admin view (improved)
  if (user && user.admin) {
    const users = getUsers();
    const bookingsObj = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');
    const allBookings = Object.values(bookingsObj).flat();
    const totalBookings = allBookings.length;
    const totalPaid = allBookings.filter(b => b && b.paid).length;
    const totalDue = totalBookings - totalPaid;
    const totalUsers = users.length;

    // recent bookings rows (most recent 8)
    const recent = allBookings.slice().sort((a,b) => {
      const ta = a && a.bookedAt ? new Date(a.bookedAt).getTime() : 0;
      const tb = b && b.bookedAt ? new Date(b.bookedAt).getTime() : 0;
      return tb - ta;
    }).slice(0, 8);

    const recentRows = recent.length ? recent.map((b, i) => {
      const movie = MOVIES[b.movieIdx];
      return `
        <tr style="background:${i % 2 === 0 ? '#0f1423' : '#0b0f1a'};">
          <td style="padding:8px 10px;border-bottom:1px solid #121426;">${escapeHtml(b.email || '-')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #121426;">${movie ? escapeHtml(movie.title) : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #121426;text-align:center;">${MOVIE_TIMINGS[b.timingIdx] || '-'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #121426;text-align:center;">${b.count}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #121426;text-align:center;">${b.paid ? `<span style="background:#1bffb6;color:#012a13;padding:6px 10px;border-radius:8px;font-weight:700;">Paid</span>` : `<span style="background:#ff18a6;color:#fff;padding:6px 10px;border-radius:8px;font-weight:700;">Due</span>`}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #121426;text-align:center;color:#bcd;">${b.bookedAt ? formatDateShort(b.bookedAt) : '-'}</td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="6" style="padding:12px;text-align:center;color:#ddd;">No recent bookings</td></tr>`;

    return `
      <section class="profile-wrap" style="max-width:1100px;margin:36px auto;padding:22px;border-radius:14px;background:linear-gradient(99deg,#11121b 40%,#0b1420 100%);box-shadow:0 8px 40px rgba(0,0,0,0.6);color:#eafaf6;">
        <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;">
          <!-- Left: Admin summary & actions -->
          <div style="flex:0 0 320px;min-width:260px;background:linear-gradient(180deg,#071226,#08192b);padding:18px;border-radius:12px;border:1px solid rgba(255,255,255,0.04);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:64px;height:64px;border-radius:12px;background:linear-gradient(90deg,#ff18a6,#1cffce);display:flex;align-items:center;justify-content:center;font-weight:900;color:#081018;font-size:1.15em;">AD</div>
              <div>
                <div style="font-size:1.18em;font-weight:800;color:#fff;">Administrator</div>
                <div style="font-size:0.95em;color:#aef3ea;">admin@neonflix.com</div>
              </div>
            </div>

            <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div style="background:#081426;padding:12px;border-radius:10px;text-align:center;">
                <div style="font-size:0.86em;color:#9ef3e8;font-weight:700;">Users</div>
                <div style="font-size:1.3em;font-weight:900;color:#fff;margin-top:6px;">${totalUsers}</div>
              </div>
              <div style="background:#081426;padding:12px;border-radius:10px;text-align:center;">
                <div style="font-size:0.86em;color:#ffd1f0;font-weight:700;">Bookings</div>
                <div style="font-size:1.3em;font-weight:900;color:#fff;margin-top:6px;">${totalBookings}</div>
              </div>
              <div style="background:#081426;padding:12px;border-radius:10px;text-align:center;">
                <div style="font-size:0.86em;color:#bdf7d8;font-weight:700;">Paid</div>
                <div style="font-size:1.16em;font-weight:900;color:#fff;margin-top:6px;">${totalPaid}</div>
              </div>
              <div style="background:#081426;padding:12px;border-radius:10px;text-align:center;">
                <div style="font-size:0.86em;color:#ffd1f0;font-weight:700;">Due</div>
                <div style="font-size:1.16em;font-weight:900;color:#fff;margin-top:6px;">${totalDue}</div>
              </div>
            </div>

            <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
              <button onclick="adminFixData()" style="width:100%;padding:10px;border-radius:10px;border:none;background:#ffd36f;color:#081018;font-weight:800;cursor:pointer;">Fix Data</button>
              <button onclick="recomputeSeatsFromPaidBookings();alert('Seat availability recomputed from current paid bookings.');render();" style="width:100%;padding:10px;border-radius:10px;border:none;background:linear-gradient(90deg,#1cffce,#6affc9);color:#081018;font-weight:800;cursor:pointer;">Recompute Seats</button>
              <button onclick="logout()" style="width:100%;padding:10px;border-radius:10px;border:none;background:#ff6fa6;color:#081018;font-weight:800;cursor:pointer;">Log out</button>
            </div>
          </div>

          <!-- Right: Recent bookings + quick stats/details -->
          <div style="flex:1 1 640px;min-width:300px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">
              <div>
                <div style="font-size:1.2em;font-weight:900;color:#fff;">Admin Dashboard</div>
                <div style="font-size:0.95em;color:#bfeff0;margin-top:6px;">Overview of system activity and quick actions</div>
              </div>
              <div style="text-align:right;color:#bcd;">
                <div style="font-weight:700;">System Time</div>
                <div style="margin-top:6px;">${(new Date()).toLocaleString()}</div>
              </div>
            </div>

            <div style="background:linear-gradient(180deg,#071726,#0b2230);padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.03);margin-bottom:12px;">
              <div style="font-weight:800;color:#fff;margin-bottom:8px;">Recent Bookings</div>
              <div style="overflow-x:auto;border-radius:8px;">
                <table style="width:100%;min-width:700px;border-collapse:collapse;font-size:.95em;">
                  <thead>
                    <tr style="background:linear-gradient(90deg,#0b1630,#071026);color:#dff;font-weight:800;">
                      <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #121426;">User</th>
                      <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #121426;">Movie</th>
                      <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #121426;">Showtime</th>
                      <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #121426;">Seats</th>
                      <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #121426;">Status</th>
                      <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #121426;">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recentRows}
                  </tbody>
                </table>
              </div>
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <div style="flex:1 1 260px;background:#071026;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.03);">
                <div style="font-weight:800;color:#fff;">Data Utilities</div>
                <div style="font-size:0.9em;color:#bcd;margin-top:8px;">Use Fix Data to merge duplicate bookings and then recompute seats to restore consistency.</div>
              </div>

              <div style="flex:1 1 260px;background:#071026;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.03);">
                <div style="font-weight:800;color:#fff;">Support</div>
                <div style="font-size:0.9em;color:#bcd;margin-top:8px;">
                  <div>WhatsApp: <a href="https://wa.me/923099934986" target="_blank" style="color:#1cffce;font-weight:700;text-decoration:underline;">0309-9934986</a></div>
                  <div style="margin-top:6px;color:#9ef3e8;">Use admin tools responsibly. Actions affect seat availability for end users.</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    `;
  }

  // Removed fallback message behavior:
  // if no user session exists, redirect to login instead of rendering a "Please log in" message.
  if (!user) { goto('login'); return ''; }

  // Regular user profile view (improved layout)
  const wl = getUserWatchlist(user.email);
  const bookingsObj = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');
  const myBookings = (bookingsObj[user.email] || []).slice().sort((a,b) => {
    const ta = a.bookedAt ? new Date(a.bookedAt).getTime() : 0;
    const tb = b.bookedAt ? new Date(b.bookedAt).getTime() : 0;
    return tb - ta;
  });

  const bookingsRows = myBookings.length ? myBookings.map((b, i) => {
    const movie = MOVIES[b.movieIdx];
    const title = movie ? escapeHtml(movie.title) : "Unknown";
    const showtime = MOVIE_TIMINGS[b.timingIdx] || "-";
    const paid = b.paid === true;
    const bookedAt = b.bookedAt ? formatDateShort(b.bookedAt) : "-";
    return `
      <tr style="background:${i % 2 === 0 ? '#0f1423' : '#0b0f1a'};">
        <td style="padding:10px 12px;border-bottom:1px solid #121426;">${title}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">${showtime}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">${b.count}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">
          ${paid ? `<span style="background:#1bffb6;color:#012a13;padding:6px 10px;border-radius:10px;font-weight:700;">Paid</span>`
                 : `<span style="background:#ff18a6;color:#fff;padding:6px 10px;border-radius:10px;font-weight:700;">Due</span>`}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;color:#bcd;">${bookedAt}</td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="5" style="padding:14px;text-align:center;color:#ddd;">You have no bookings yet.</td></tr>`;

  return `
  <section class="profile-wrap" style="max-width:920px;margin:40px auto;padding:22px;border-radius:18px;background:linear-gradient(99deg,#191225 60%,#2a1931 100%);box-shadow:0 4px 32px rgba(0,0,0,0.6);color:#fff;">
    <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;">
      <!-- Left column: account card -->
      <div style="flex:1 1 320px;min-width:280px;background:linear-gradient(180deg,#0f1220,#121428);padding:18px;border-radius:12px;border:1px solid rgba(255,255,255,0.03);">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:64px;height:64px;border-radius:12px;background:linear-gradient(90deg,#ff18a6,#1cffce);display:flex;align-items:center;justify-content:center;font-weight:900;color:#081018;font-size:1.1em;">NF</div>
          <div>
            <div style="font-size:1.18em;font-weight:800;color:#fff;">${escapeHtml(user.email)}</div>
            <div style="font-size:0.95em;color:#9ef3e8;">NeonFlix Member</div>
          </div>
        </div>

        <div style="margin-top:14px;border-top:1px dashed rgba(255,255,255,0.04);padding-top:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="color:#bfeff0;font-weight:700;">Watchlist</div>
            <div style="background:#12202a;padding:6px 10px;border-radius:10px;color:#bdeefd;font-weight:700;">${(wl||[]).length}</div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="color:#bfeff0;font-weight:700;">Bookings</div>
            <div style="background:#12202a;padding:6px 10px;border-radius:10px;color:#bdeefd;font-weight:700;">${myBookings.length}</div>
          </div>
        </div>

        <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
          <button onclick="goto('watchlist')" style="width:100%;padding:10px;border-radius:12px;border:none;background:var(--neon);color:#081018;font-weight:800;cursor:pointer;">View Watchlist</button>
          <button onclick="goto('home')" style="width:100%;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:#fff;font-weight:700;cursor:pointer;">Browse Movies</button>
          <button onclick="logout()" class="toggle-admin neon" style="width:100%;padding:10px;border-radius:12px;border:none;background:#ff6fa6;color:#081018;font-weight:800;cursor:pointer;">Log out</button>
        </div>
      </div>

      <!-- Right column: payments & bookings -->
      <div style="flex:1 1 540px;min-width:300px;">
        <div style="background:linear-gradient(180deg,#0c1724,#0e2633);padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.03);margin-bottom:14px;">
          <div style="font-size:1.05em;font-weight:800;color:#fff;margin-bottom:6px;">Payment & Ticket Info</div>
          <div style="color:#cfeeea;font-size:0.96em;line-height:1.45;">
            <p style="margin:6px 0;">
              For seat payment, contact us on WhatsApp:
              <a href="https://wa.me/923099934986" target="_blank" style="color:#1cffce;font-weight:800;text-decoration:underline;">0309-9934986</a>
            </p>
            <p style="margin:6px 0;">
              <strong>Ticket pickup:</strong> After payment is confirmed by admin, your ticket will be awarded to you at the check counter outside the cinema hall.
            </p>
            <p style="margin:6px 0;color:#ffd1f0;">
              <strong>Refund policy:</strong> If you cancel after booking is confirmed, you will receive only <strong>80%</strong> of the payment back.
            </p>
          </div>
        </div>

        <div style="background:linear-gradient(180deg,#07101b,#0b1624);padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-size:1.05em;font-weight:800;color:#fff;">Your Bookings</div>
            <div style="font-size:0.9em;color:#9ef3e8;">Latest first</div>
          </div>

          <div style="overflow-x:auto;border-radius:8px;">
            <table style="width:100%;min-width:700px;border-collapse:collapse;font-size:.96em;">
              <thead>
                <tr style="background:linear-gradient(90deg,#0b1630,#071026);color:#dff;font-weight:800;">
                  <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #121426;">Movie</th>
                  <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Showtime</th>
                  <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Seats</th>
                  <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Payment</th>
                  <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Booked At</th>
                </tr>
              </thead>
              <tbody>
                ${bookingsRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </section>
  `;
}

// --- Admin Add Movie Form ---
function adminPanel(){
  return `
  <div class="admin-panel">
    <h2 class="ap-title" style="background:linear-gradient(90deg,#ff18a6 30%,#1cffce 100%);color:transparent;-webkit-background-clip:text;background-clip:text;padding-bottom:0.32em;">Admin: Add New Movie</h2>
    <form id="addForm">
      <input name="title" required placeholder="Title"/>
      <input name="poster" placeholder="Poster URL"/>
      <input name="year" type="number" min="1900" max="2100" required placeholder="Year"/>
      <input name="rating" type="number" min="0" max="10" step=".1" required placeholder="Rating"/>
      <input name="genre" required placeholder="Genre"/>
      <input name="language" required placeholder="Language"/>
      <input name="duration" type="number" min="1" max="400" required placeholder="Duration (min)"/>
      <input name="actors" required placeholder="Actors (comma separated)"/>
      <input name="desc" required placeholder="Short Description"/>
      <button class="ap-add-btn neon" type="submit">＋ Add Movie</button>
    </form>
  </div>
  `;
}

// ================= Helper: user-specific watchlist storage ==========
function getUserWatchlist(email) {
  if (!email) return [];
  const allWatchlists = JSON.parse(localStorage.getItem("nf_watchlist_USERS") || '{}');
  return allWatchlists[email] || [];
}
window.toggleWatchlist = function(movieIdx) {
  if (!user || user.admin) return; // Only regular users can modify their watchlist

  const email = user.email;
  let allWatchlists = JSON.parse(localStorage.getItem("nf_watchlist_USERS") || '{}');
  let wl = allWatchlists[email] || [];
  const idx = wl.indexOf(movieIdx);

  if (idx > -1) {
    wl.splice(idx, 1);
  } else {
    wl.push(movieIdx);
  }
  allWatchlists[email] = wl;
  localStorage.setItem("nf_watchlist_USERS", JSON.stringify(allWatchlists));
  // Ensure SPA reflects the latest
  watchlist = wl;
  render();
};

// ================== Admin: Bookings & Watchlists Overview ===========
// Improved formatting: responsive container, zebra rows, "Booked At" column, clearer payment badges.
// Added "Check" action button for admins to mark Paid / Due.
// Added "Fix Data" admin button which calls normalizeBookings().
function adminUserBookingsPanel() {
  const users = getUsers();
  const bookings = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');

  // Collect rows with stable ordering (by bookedAt if present) and preserve original user booking index
  let allRows = [];
  Object.entries(bookings).forEach(([email, arr]) => {
    (arr || []).forEach((entry, entryIdx) => {
      allRows.push({ email, entry, entryIdx });
    });
  });

  // sort by bookedAt descending (newest first) when available
  allRows.sort((a, b) => {
    const ta = a.entry.bookedAt ? new Date(a.entry.bookedAt).getTime() : 0;
    const tb = b.entry.bookedAt ? new Date(b.entry.bookedAt).getTime() : 0;
    return tb - ta;
  });

  const rowsHtml = allRows.map((r, idx) => {
    const email = r.email;
    const entry = r.entry;
    const entryIdx = r.entryIdx;
    const movie = MOVIES[entry.movieIdx];
    if (!movie) return '';
    const paid = entry.paid === true;
    const bookedAt = entry.bookedAt ? formatDateShort(entry.bookedAt) : "-";
    // zebra background
    const bg = idx % 2 === 0 ? "#0b0f1a" : "#0f1423";
    return `
      <tr style="background:${bg};">
        <td style="padding:10px 12px;border-bottom:1px solid #121426;">${escapeHtml(email)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;">${escapeHtml(movie.title)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">${MOVIE_TIMINGS[entry.timingIdx]}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">${entry.count}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">
          ${paid ? `<span style="display:inline-block;background:#1bffb6;color:#012a13;padding:6px 10px;border-radius:12px;font-weight:700;">Paid</span>`
                 : `<span style="display:inline-block;background:#ff18a6;color:#fff;padding:6px 10px;border-radius:12px;font-weight:700;">Due</span>`}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;color:#bcd;">${bookedAt}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">
          <button onclick="toggleBookingPaid('${escapeAttr(email)}', ${entryIdx});event.stopPropagation();" style="padding:6px 10px;border-radius:10px;border:none;background:${paid? '#ff8aa6' : 'var(--neon)'};color:#081018;font-weight:700;cursor:pointer;">
            ${paid ? 'Mark Due' : 'Mark Paid'}
          </button>
        </td>
      </tr>
    `;
  }).join("");

  return `
  <div class="admin-panel" style="margin-top:2em;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <h2 style="margin-bottom:8px;">🎟 User Seat Bookings</h2>
      <div>
        <button onclick="adminFixData()" style="margin-left:12px;padding:8px 12px;border-radius:10px;border:none;background:#ffd36f;color:#081018;font-weight:700;cursor:pointer;">Fix Data</button>
      </div>
    </div>

    <div style="overflow-x:auto;border-radius:10px;padding:8px;border:1px solid rgba(28,255,206,0.07);background:linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.02));">
      <table style="width:100%;min-width:920px;border-collapse:collapse;font-size:0.98em;">
        <thead>
          <tr style="background:linear-gradient(90deg,#1b0f29,#0b1624);color:#dff; font-weight:800;">
            <th style="padding:12px 14px;text-align:left;border-bottom:2px solid #121426;">Email</th>
            <th style="padding:12px 14px;text-align:left;border-bottom:2px solid #121426;">Movie</th>
            <th style="padding:12px 14px;text-align:center;border-bottom:2px solid #121426;">Showtime</th>
            <th style="padding:12px 14px;text-align:center;border-bottom:2px solid #121426;">Seats</th>
            <th style="padding:12px 14px;text-align:center;border-bottom:2px solid #121426;">Payment</th>
            <th style="padding:12px 14px;text-align:center;border-bottom:2px solid #121426;">Booked At</th>
            <th style="padding:12px 14px;text-align:center;border-bottom:2px solid #121426;">Check</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="7" style="padding:18px 12px;text-align:center;color:#ddd;">No bookings yet.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;font-size:0.95em;color:#ffd1f0;">
      Note: unpaid bookings do not reserve seats and are shown as "Due". Use the "Check" button to mark Paid (admin) — marking Paid will deduct seats if available. Use "Fix Data" to merge duplicate entries and recompute seats from paid bookings.
    </div>
  </div>
  `;
}

// Admin toggles Paid/Due for a booking entry (identified by user email and index in their array).
// We toggle the flag, persist, then normalize + recompute to keep seat counts authoritative.
window.toggleBookingPaid = function(email, entryIdx) {
  if (!user || !user.admin) {
    alert("Only admins can perform this action.");
    return;
  }
  const bookings = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');
  if (!bookings[email] || !bookings[email][entryIdx]) {
    alert("Booking entry not found.");
    return;
  }

  // Toggle flag
  bookings[email][entryIdx].paid = !bookings[email][entryIdx].paid;

  // Save then normalize & rebuild seats to keep everything consistent
  localStorage.setItem("nf_bookings_USERS", JSON.stringify(bookings));
  normalizeBookings();

  alert(`Booking for ${email} marked as ${bookings[email][entryIdx].paid ? 'Paid' : 'Due'}. Seat counts recalculated.`);
  render();
};

// --- Admin Booking Sheet ---
function adminSeatsPanel() {
  const seatsAll = JSON.parse(localStorage.getItem("nf_movieSeats") || "[]");
  return `
  <div class="admin-panel" style="margin-top:32px;border:2px dashed #1cffce7f;">
    <h2 style="color:#fff;">🎟 All Booking Data (Per Timing)</h2>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="padding:6px 8px;background:#170d25;color:#1cffce;">Movie</th>
          ${MOVIE_TIMINGS.map(tm=>`<th style="padding:6px 8px;background:#0b1820;color:#a1fff2;">${tm}</th>`).join("")}
        </tr></thead>
        <tbody>
          ${MOVIES.map((m, i) =>
            `<tr>
              <td style="padding:6px 8px;color:#1cffce;cursor:pointer;font-weight:700;background:#190e28;text-decoration:underline;"
                  onclick="showMovieBookings(${i})">${escapeHtml(m.title)}</td>
              ${MOVIE_TIMINGS.map((tm, tIdx) => {
                const seatsLeft = seatsAll[i] ? (seatsAll[i][tIdx] !== undefined ? seatsAll[i][tIdx] : SEATS_TOTAL) : SEATS_TOTAL;
                const booked = SEATS_TOTAL - seatsLeft;
                const bookedLabel = seatsLeft === 0 ? `<br><span style="color:#fd18a6;letter-spacing:.03em;font-size:.91em;font-weight:800;">Booked</span>` : "";
                return `<td style="padding:6px 8px;background:#121732;text-align:center;">
                  ${seatsLeft} left<br>
                  <span style="font-size:.94em;">${booked} booked</span>
                  ${bookedLabel}
                </td>`;
              }).join("")}
            </tr>`
          ).join("")}
        </tbody>
      </table>
    </div>
  </div>
  `;
}

// --- Show Movie Bookings Modal (called when admin clicks a movie) ---
window.showMovieBookings = function(movieIdx) {
  const bookings = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');

  let rows = '';
  // build list per movie preserving user booking index for toggle action
  const entries = [];
  Object.entries(bookings).forEach(([email, arr]) => {
    (arr || []).forEach((e, entryIdx) => {
      if (e.movieIdx === movieIdx) entries.push({ email, entry: e, entryIdx });
    });
  });
  entries.sort((a,b) => {
    const ta = a.entry.bookedAt ? new Date(a.entry.bookedAt).getTime() : 0;
    const tb = b.entry.bookedAt ? new Date(b.entry.bookedAt).getTime() : 0;
    return tb - ta;
  });

  entries.forEach((r, idx) => {
    const email = r.email;
    const entry = r.entry;
    const entryIdx = r.entryIdx;
    const paid = entry.paid === true;
    const bookedAt = entry.bookedAt ? formatDateShort(entry.bookedAt) : "-";
    const bg = idx % 2 === 0 ? "#0b0f1a" : "#0f1423";
    rows += `<tr style="background:${bg};">
      <td style="padding:10px 12px;border-bottom:1px solid #121426;">${escapeHtml(email)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">${MOVIE_TIMINGS[entry.timingIdx]}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">${entry.count}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">
        ${paid ? `<span style="display:inline-block;background:#1bffb6;color:#012a13;padding:6px 10px;border-radius:12px;font-weight:700;">Paid</span>` : `<span style="display:inline-block;background:#ff18a6;color:#fff;padding:6px 10px;border-radius:12px;font-weight:700;">Due</span>`}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;color:#bcd;">${bookedAt}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #121426;text-align:center;">
        <button onclick="toggleBookingPaid('${escapeAttr(email)}', ${entryIdx});event.stopPropagation();" style="padding:6px 10px;border-radius:10px;border:none;background:${paid? '#ff8aa6' : 'var(--neon)'};color:#081018;font-weight:700;cursor:pointer;">
          ${paid ? 'Mark Due' : 'Mark Paid'}
        </button>
      </td>
    </tr>`;
  });

  if (!rows) rows = `<tr><td colspan="6" style="color:#aaa;text-align:center;padding:18px;">No bookings for this movie.</td></tr>`;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="modal-bg" style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9001;background:rgba(14,0,23,.72);" onclick="document.getElementById('modal-bookings')?.remove();this.remove();"></div>
    <div id="modal-bookings" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9002;background:#180d29;color:#fff;border-radius:14px;padding:20px;min-width:320px;max-width:95vw;">
      <div style="margin:0 0 12px 0;text-align:center;font-size:1.12em;">
        <b>${escapeHtml(MOVIES[movieIdx].title)} — User Bookings</b>
      </div>
      <div style="overflow-x:auto;border-radius:8px;padding:6px;border:1px solid rgba(28,255,206,0.06);">
        <table style="width:100%;min-width:700px;border-collapse:collapse;font-size:.98em;">
          <thead>
            <tr style="background:linear-gradient(90deg,#1b0f29,#0b1624);color:#dff;font-weight:800;">
              <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #121426;">User Email</th>
              <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Showtime</th>
              <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Seats</th>
              <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Payment</th>
              <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Booked At</th>
              <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #121426;">Check</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <div style="text-align:center;margin-top:12px;">
        <button onclick="document.getElementById('modal-bookings').remove();document.getElementById('modal-bg').remove();" style="margin-top:12px;padding:8px 20px;border:none;border-radius:20px;background:var(--neon);color:#fff;font-weight:700;cursor:pointer;">Close</button>
      </div>
    </div>
  `);
};

// ================ Booking flow (user) ================================
// New policy: unpaid bookings do NOT decrement seats. We merge per-user/movie/time.
window.bookSeat = function(movieIdx, timingIdx) {
  if(!user) { alert("Please login to book."); return; }
  // Only users can book (not admins)
  if (user.admin) { alert("Admins cannot book seats."); return; }

  // Create/merge booking entry, mark unpaid
  const email = user.email;
  let bookings = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');
  bookings[email] = bookings[email] || [];

  // Merge into a single entry per movie+time
  let existing = bookings[email].find(b => b.movieIdx === movieIdx && b.timingIdx === timingIdx);
  if (existing) {
    existing.count = (existing.count || 0) + 1;
    existing.paid = false; // require admin confirmation for the new seat
    existing.bookedAt = existing.bookedAt || new Date().toISOString();
  } else {
    bookings[email].push({ movieIdx, timingIdx, count: 1, bookedAt: new Date().toISOString(), paid: false });
  }

  localStorage.setItem("nf_bookings_USERS", JSON.stringify(bookings));

  // Inform user about payment/refund policy and that admin must mark Paid to confirm seat
  alert("Booking recorded as Due. Admin must confirm payment to finalize your seats. Note: once a seat is booked, you will get only 80% payment back if you cancel.");
  render();
};

// =================== Admin: Edit & Delete Movie ======================
window.editMovie = function(index) {
  const movie = MOVIES[index];
  if (!movie) { alert("Movie not found."); return; }
  // Show a modal with a simple edit form
  const modalId = "modal-edit-movie";
  const modalBgId = "modal-bg-edit";
  // Remove existing if any
  const prev = document.getElementById(modalId);
  const prevBg = document.getElementById(modalBgId);
  if (prev) prev.remove();
  if (prevBg) prevBg.remove();

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${modalBgId}" style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9001;background:rgba(0,0,0,.6);" onclick="document.getElementById('${modalId}').remove();this.remove();"></div>
    <div id="${modalId}" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9002;background:#120617;color:#fff;border-radius:12px;padding:18px;min-width:320px;max-width:95vw;">
      <h3 style="margin-top:0;">Edit Movie</h3>
      <form id="editMovieForm">
        <input name="title" value="${escapeAttr(movie.title)}" required placeholder="Title" style="width:100%;margin:6px 0;padding:8px;"/>
        <input name="poster" value="${escapeAttr(movie.poster||'')}" placeholder="Poster URL" style="width:100%;margin:6px 0;padding:8px;"/>
        <input name="year" type="number" value="${movie.year}" style="width:100%;margin:6px 0;padding:8px;"/>
        <input name="rating" type="number" step=".1" value="${movie.rating}" style="width:100%;margin:6px 0;padding:8px;"/>
        <input name="genre" value="${escapeAttr(movie.genre)}" style="width:100%;margin:6px 0;padding:8px;"/>
        <input name="language" value="${escapeAttr(movie.language)}" style="width:100%;margin:6px 0;padding:8px;"/>
        <input name="duration" type="number" value="${movie.duration}" style="width:100%;margin:6px 0;padding:8px;"/>
        <input name="actors" value="${escapeAttr(movie.actors.join(', '))}" style="width:100%;margin:6px 0;padding:8px;"/>
        <textarea name="desc" style="width:100%;margin:6px 0;padding:8px;" placeholder="Description">${escapeHtml(movie.desc)}</textarea>
        <div style="text-align:right;margin-top:8px;">
          <button type="button" onclick="document.getElementById('${modalId}').remove();document.getElementById('${modalBgId}').remove();" style="margin-right:8px;">Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  `);

  const frm = document.getElementById("editMovieForm");
  if (frm) {
    frm.onsubmit = function(e) {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(frm).entries());
      movie.title = f.title;
      movie.poster = f.poster;
      movie.year = +f.year;
      movie.rating = +f.rating;
      movie.genre = f.genre;
      movie.language = f.language;
      movie.duration = +f.duration;
      movie.actors = f.actors.split(",").map(s=>s.trim());
      movie.desc = f.desc;
      // ensure timings & seats exist
      if (!movie.timings) movie.timings = [...MOVIE_TIMINGS];
      if (!movie.seats) movie.seats = Array(movie.timings.length).fill(SEATS_TOTAL);
      render();
      document.getElementById(modalId).remove();
      document.getElementById(modalBgId).remove();
    };
  }
};

window.delMovie = function(idx) {
  if (!confirm("Delete this movie? This action cannot be undone.")) return;
  MOVIES.splice(idx, 1);
  // remove seats entry
  const seats = JSON.parse(localStorage.getItem("nf_movieSeats") || '[]');
  seats.splice(idx, 1);
  localStorage.setItem("nf_movieSeats", JSON.stringify(seats));
  // Update bookings: remove entries for this movie from all users
  const bookings = JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');
  Object.keys(bookings).forEach(email => {
    bookings[email] = bookings[email].filter(b => b.movieIdx !== idx).map(b => {
      // if movie index greater than deleted index, shift it down by 1
      if (b.movieIdx > idx) b.movieIdx--;
      return b;
    });
  });
  localStorage.setItem("nf_bookings_USERS", JSON.stringify(bookings));
  // Update watchlists
  const allWL = JSON.parse(localStorage.getItem("nf_watchlist_USERS") || '{}');
  Object.keys(allWL).forEach(email => {
    allWL[email] = allWL[email].filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
  });
  localStorage.setItem("nf_watchlist_USERS", JSON.stringify(allWL));
  render();
};

// ===================== Small utilities ==============================
function posterFallback(img){
  img.onerror=null;
  img.src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format=compress&w=400&q=80";
  img.style.background=`linear-gradient(90deg,#1cffce 30%,#ff18a7 90%)`;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/\n/g, " ");
}
function formatDateShort(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return "-";
    return d.toLocaleString();
  } catch (e) {
    return "-";
  }
}

// =================== Authentication form handlers ==================
// Attach handlers each render to bind to newly created form DOM nodes
window.attachAuthHandlers = function() {
  // Admin login handler
  const adminForm = document.getElementById('adminLoginForm');
  if (adminForm) {
    adminForm.onsubmit = function(e) {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(adminForm).entries());
      // Check against constants at top of file
      if (f.adminname === ADMIN_USERNAME && f.password === ADMIN_PASSWORD) {
        localStorage.setItem('nf_email', 'admin@neonflix.com');
        user = { email: 'admin@neonflix.com', admin: true };
        loginRole = null;
        const err = document.getElementById('login-error');
        if (err) err.textContent = '';
        goto('home');
        render();
      } else {
        const el = document.getElementById('login-error');
        if (el) el.textContent = 'Invalid admin credentials';
      }
    };
  }

  // Regular user login handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.onsubmit = function(e) {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(loginForm).entries());
      const users = getUsers();
      const found = users.find(u => u.email === f.email && u.password === f.password);
      const el = document.getElementById('login-error');
      if (found) {
        localStorage.setItem('nf_email', f.email);
        user = { email: f.email, admin: false };
        // load user's watchlist if any
        const allWL = JSON.parse(localStorage.getItem("nf_watchlist_USERS") || "{}");
        watchlist = allWL[f.email] || [];
        loginRole = null;
        if (el) el.textContent = '';
        goto('home');
        render();
      } else {
        if (el) el.textContent = 'Invalid email or password';
      }
    };
  }

  // Registration handler
  const regForm = document.getElementById('regForm');
  if (regForm) {
    regForm.onsubmit = function(e) {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(regForm).entries());
      const users = getUsers();
      const el = document.getElementById('reg-error');
      if (users.find(u => u.email === f.email)) {
        if (el) el.textContent = 'Email already registered';
        return;
      }
      users.push({ email: f.email, password: f.password });
      saveUsers(users);
      // initialize user's watchlist container
      const allWL = JSON.parse(localStorage.getItem("nf_watchlist_USERS") || "{}");
      allWL[f.email] = allWL[f.email] || [];
      localStorage.setItem("nf_watchlist_USERS", JSON.stringify(allWL));
      // auto-login newly registered user
      localStorage.setItem('nf_email', f.email);
      user = { email: f.email, admin: false };
      watchlist = allWL[f.email];
      loginRole = null;
      if (el) el.textContent = '';
      goto('home');
      render();
    };
  }
};

// ================== Initial Load / Session Handling =================
window.addEventListener("DOMContentLoaded", ()=>{
  let email = localStorage.getItem("nf_email");
  if(email === "admin@neonflix.com") user = {email, admin:true};
  else if(email) user = {email, admin:false};

  // Ensure nf_movieSeats exists and is consistent with MOVIES
  let seats = JSON.parse(localStorage.getItem("nf_movieSeats") || "[]");
  if (!Array.isArray(seats) || seats.length !== MOVIES.length) {
    seats = MOVIES.map(m => Array(m.timings.length).fill(SEATS_TOTAL));
    localStorage.setItem("nf_movieSeats", JSON.stringify(seats));
  }

  // Ensure nf_watchlist exists for non-admin
  if (user && !user.admin) {
    watchlist = getUserWatchlist(user.email);
  }

  // Start app at home if someone is logged in, otherwise show login
  goto(user ? 'home' : 'login');
});

// =================== Logout / Session utilities =====================
window.logout = function() {
  localStorage.removeItem("nf_email");
  user = null;
  loginRole = null;
  goto('login');
  render();
};

// =================== Misc helpers for admin user lists =================
function getAllUserBookings() {
  return JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}');
}
function getAllUserWatchlists() {
  return JSON.parse(localStorage.getItem("nf_watchlist_USERS") || '{}');
}

// =================== Poster / UI helpers (stubs) =====================
window.addEventListener("load", ()=>{
  // Attach any global UI behaviors if necessary
});

// =================== Extra debug command (optional) ==================
window.__neon_debug = function() {
  return {
    user,
    movies: MOVIES,
    seats: JSON.parse(localStorage.getItem("nf_movieSeats") || '[]'),
    users: getUsers(),
    bookings: JSON.parse(localStorage.getItem("nf_bookings_USERS") || '{}'),
    watchlists: JSON.parse(localStorage.getItem("nf_watchlist_USERS") || '{}')
  };
};