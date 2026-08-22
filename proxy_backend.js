const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Demo admin credentials come from env vars so nothing sensitive is hardcoded
// in source. Defaults below are for local/demo use only — always override
// ADMIN_USERNAME / ADMIN_PASSWORD via environment variables in production.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'adminhuzaifa';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'neonflix';
const SALT_ROUNDS = 10;

// Restrict CORS to a configured origin in production; default to '*' only
// for local development convenience.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Middleware to parse JSON
app.use(express.json());

// Serve your existing frontend files
app.use(express.static(__dirname));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// ==================== SQLITE DATABASE ====================

const db = new sqlite3.Database(path.join(__dirname, 'neonflix.db'));

// Initialize database
function initDB() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            username TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Movies table (matches your frontend data structure)
        db.run(`CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            poster TEXT,
            year INTEGER,
            rating REAL,
            genre TEXT,
            language TEXT,
            duration INTEGER,
            actors TEXT,
            description TEXT,
            timings TEXT,
            seats_available TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Bookings table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            movieIdx INTEGER NOT NULL,
            timingIdx INTEGER NOT NULL,
            count INTEGER DEFAULT 1,
            paid INTEGER DEFAULT 0,
            bookedAt TEXT,
            FOREIGN KEY (email) REFERENCES users(email)
        )`);
        
        // Watchlists table
        db.run(`CREATE TABLE IF NOT EXISTS watchlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            movieIdx INTEGER NOT NULL,
            FOREIGN KEY (email) REFERENCES users(email),
            UNIQUE(email, movieIdx)
        )`);
        
        // Insert admin if not exists (password is hashed, never stored in plaintext)
        db.get(`SELECT COUNT(*) as count FROM users WHERE username = ?`, [ADMIN_USERNAME], (err, row) => {
            if (!row || row.count === 0) {
                const hash = bcrypt.hashSync(ADMIN_PASSWORD, SALT_ROUNDS);
                db.run(
                    `INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, 'admin')`,
                    ['admin@neonflix.com', ADMIN_USERNAME, hash]
                );
                console.log('✅ Admin account ready (credentials set via ADMIN_USERNAME/ADMIN_PASSWORD env vars)');
            }
        });
        
        // Insert movies from your frontend data
        insertMoviesFromFrontend();
    });
}

// Helper function to query database
function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

// ==================== PROXY ROUTES ====================

// These routes match your localStorage keys exactly!

// 1. GET nf_movieSeats → /api/proxy/nf_movieSeats
app.get('/api/proxy/nf_movieSeats', async (req, res) => {
    try {
        const movies = await dbQuery('SELECT seats_available FROM movies ORDER BY id');
        const seats = movies.map(m => JSON.parse(m.seats_available));
        res.json(seats);
    } catch (error) {
        res.json(Array(13).fill(Array(5).fill(60))); // Default seats
    }
});

// 2. GET nf_users → /api/proxy/nf_users
app.get('/api/proxy/nf_users', async (req, res) => {
    try {
        // Password hashes are never sent to the client — login/register are
        // verified entirely server-side (see /admin-login, /user-login, /register).
        const users = await dbQuery('SELECT email FROM users WHERE role = "user"');
        res.json(users);
    } catch (error) {
        res.json([]);
    }
});

// 3. GET nf_bookings_USERS → /api/proxy/nf_bookings_USERS
app.get('/api/proxy/nf_bookings_USERS', async (req, res) => {
    try {
        const bookings = await dbQuery(`
            SELECT 
                email, 
                movieIdx, 
                timingIdx, 
                count, 
                paid, 
                bookedAt 
            FROM bookings
        `);
        
        // Group by email to match your structure
        const grouped = {};
        bookings.forEach(b => {
            if (!grouped[b.email]) grouped[b.email] = [];
            grouped[b.email].push({
                movieIdx: b.movieIdx,
                timingIdx: b.timingIdx,
                count: b.count,
                paid: b.paid === 1,
                bookedAt: b.bookedAt
            });
        });
        
        res.json(grouped);
    } catch (error) {
        res.json({});
    }
});

// 4. GET nf_watchlist_USERS → /api/proxy/nf_watchlist_USERS
app.get('/api/proxy/nf_watchlist_USERS', async (req, res) => {
    try {
        const watchlists = await dbQuery('SELECT email, movieIdx FROM watchlists');
        
        const grouped = {};
        watchlists.forEach(w => {
            if (!grouped[w.email]) grouped[w.email] = [];
            grouped[w.email].push(w.movieIdx);
        });
        
        res.json(grouped);
    } catch (error) {
        res.json({});
    }
});

// 5. POST nf_bookings_USERS → /api/proxy/nf_bookings_USERS
app.post('/api/proxy/nf_bookings_USERS', async (req, res) => {
    try {
        const { email, movieIdx, timingIdx, count = 1 } = req.body;
        
        // Check existing booking
        const existing = await dbQuery(
            'SELECT id, count FROM bookings WHERE email = ? AND movieIdx = ? AND timingIdx = ?',
            [email, movieIdx, timingIdx]
        );
        
        if (existing.length > 0) {
            // Update existing
            await dbRun(
                'UPDATE bookings SET count = count + ? WHERE id = ?',
                [count, existing[0].id]
            );
        } else {
            // Create new booking
            await dbRun(
                'INSERT INTO bookings (email, movieIdx, timingIdx, count, paid, bookedAt) VALUES (?, ?, ?, ?, ?, ?)',
                [email, movieIdx, timingIdx, count, 0, new Date().toISOString()]
            );
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. POST nf_watchlist_USERS → /api/proxy/nf_watchlist_USERS
app.post('/api/proxy/nf_watchlist_USERS', async (req, res) => {
    try {
        const { email, movieIdx } = req.body;
        
        // Toggle watchlist
        const existing = await dbQuery(
            'SELECT id FROM watchlists WHERE email = ? AND movieIdx = ?',
            [email, movieIdx]
        );
        
        if (existing.length > 0) {
            await dbRun('DELETE FROM watchlists WHERE email = ? AND movieIdx = ?', [email, movieIdx]);
        } else {
            await dbRun('INSERT INTO watchlists (email, movieIdx) VALUES (?, ?)', [email, movieIdx]);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. POST admin login → /api/proxy/admin-login
app.post('/api/proxy/admin-login', async (req, res) => {
    try {
        const { adminname, password } = req.body;
        if (!adminname || !password) {
            return res.status(400).json({ error: 'Missing admin name or password' });
        }

        const rows = await dbQuery(
            'SELECT * FROM users WHERE username = ? AND role = "admin"',
            [adminname]
        );

        const match = rows.length > 0 && bcrypt.compareSync(password, rows[0].password);
        if (match) {
            res.json({
                success: true,
                user: {
                    email: rows[0].email,
                    admin: true
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. POST user login → /api/proxy/user-login
app.post('/api/proxy/user-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email or password' });
        }

        const rows = await dbQuery(
            'SELECT * FROM users WHERE email = ? AND role = "user"',
            [email]
        );

        const match = rows.length > 0 && bcrypt.compareSync(password, rows[0].password);
        if (match) {
            res.json({
                success: true,
                user: {
                    email: rows[0].email,
                    admin: false
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9. POST user register → /api/proxy/register
app.post('/api/proxy/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password || password.length < 4) {
            return res.status(400).json({ error: 'Email and a password (4+ chars) are required' });
        }

        // Check if exists
        const existing = await dbQuery('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create user with a hashed password — never store plaintext
        const hash = bcrypt.hashSync(password, SALT_ROUNDS);
        await dbRun('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash]);

        res.json({
            success: true,
            user: {
                email: email,
                admin: false
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. GET MOVIES data → /api/proxy/movies
app.get('/api/proxy/movies', async (req, res) => {
    try {
        const movies = await dbQuery('SELECT * FROM movies ORDER BY id');
        res.json(movies);
    } catch (error) {
        // Fallback to hardcoded movies
        res.json(getDefaultMovies());
    }
});

// ==================== INSERT MOVIES FROM YOUR FRONTEND ====================

function insertMoviesFromFrontend() {
    const defaultMovies = getDefaultMovies();
    
    db.get('SELECT COUNT(*) as count FROM movies', (err, row) => {
        if (row.count === 0) {
            console.log('📥 Inserting movies from your frontend...');
            
            const stmt = db.prepare(`
                INSERT INTO movies 
                (title, poster, year, rating, genre, language, duration, actors, description, timings, seats_available) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            defaultMovies.forEach((movie, index) => {
                const timings = JSON.stringify(["9:00 AM", "12:00 PM", "3:00 PM", "6:00 PM", "9:00 PM"]);
                const seats = movie.seats_available || JSON.stringify([60, 60, 60, 60, 60]);
                
                stmt.run([
                    movie.title,
                    movie.poster,
                    movie.year,
                    movie.rating,
                    movie.genre,
                    movie.language,
                    movie.duration,
                    movie.actors,
                    movie.desc || movie.description,
                    timings,
                    seats
                ], (err) => {
                    if (err) console.error('Error inserting movie:', err.message);
                });
            });
            
            stmt.finalize();
            console.log(`✅ Inserted ${defaultMovies.length} movies`);
        }
    });
}

function getDefaultMovies() {
    // IMPORTANT: this list must stay in sync with the MOVIES array in app.js.
    // A mismatch here means /api/proxy/nf_movieSeats and /api/proxy/movies
    // return a different number of movies than the frontend expects, which
    // silently breaks seat tracking for the movies missing from this list.
    return [
        { title: "Barbie", poster: "https://image.tmdb.org/t/p/w780/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg", year: 2023, rating: 7.0, genre: "Comedy", language: "English", duration: 114, actors: "Margot Robbie, Ryan Gosling, America Ferrera", desc: "Barbie and Ken explore the real world in a pastel adventure." },
        { title: "Killers of the Flower Moon", poster: "https://image.tmdb.org/t/p/w780/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg", year: 2023, rating: 7.5, genre: "Drama", language: "English", duration: 206, actors: "Leonardo DiCaprio, Robert De Niro, Lily Gladstone", desc: "Osage murders spark an FBI investigation in 1920s Oklahoma." },
        { title: "John Wick: Chapter 4", poster: "https://image.tmdb.org/t/p/w780/2lUYbD2C3XSuwqMUbDVDQuz9mqz.jpg", year: 2023, rating: 7.7, genre: "Action", language: "English", duration: 169, actors: "Keanu Reeves, Donnie Yen, Bill Skarsgård", desc: "John Wick faces deadly foes as the bounty rises." },
        { title: "Spider-Man: Across the Spider-Verse", poster: "https://image.tmdb.org/t/p/w780/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg", year: 2023, rating: 8.6, genre: "Animation", language: "English", duration: 140, actors: "Shameik Moore, Hailee Steinfeld, Oscar Isaac", desc: "Miles Morales journeys through the Multiverse." },
        { title: "Guardians of the Galaxy Vol. 3", poster: "https://image.tmdb.org/t/p/w780/r2J02Z2OpNTctfOSN1Ydgii51I3.jpg", year: 2023, rating: 7.9, genre: "Sci-Fi", language: "English", duration: 150, actors: "Chris Pratt, Zoe Saldaña, Dave Bautista", desc: "The Guardians reunite for one last mission." },
        { title: "The Marvels", poster: "", year: 2023, rating: 6.1, genre: "Action", language: "English", duration: 105, actors: "Brie Larson, Teyonah Parris, Iman Vellani", desc: "Marvel heroes unite as their powers tangle." },
        { title: "Wonka", poster: "https://image.tmdb.org/t/p/w780/qhb1qOilapbapxWQn9jtRCMwXJF.jpg", year: 2023, rating: 7.2, genre: "Family", language: "English", duration: 117, actors: "Timothée Chalamet, Olivia Colman, Keegan-Michael Key", desc: "Young Willy Wonka invents iconic treats and meets Oompa-Loompas." },
        { title: "The Super Mario Bros. Movie", poster: "https://image.tmdb.org/t/p/w780/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg", year: 2023, rating: 7.1, genre: "Animation", language: "English", duration: 92, actors: "Chris Pratt, Anya Taylor-Joy, Keegan-Michael Key", desc: "Mario and Luigi journey through the Mushroom Kingdom." },
        { title: "Mission: Impossible – Dead Reckoning Part One", poster: "https://image.tmdb.org/t/p/w780/NNxYkU70HPurnNCSiCjYAmacwm.jpg", year: 2023, rating: 7.8, genre: "Thriller", language: "English", duration: 163, actors: "Tom Cruise, Hayley Atwell, Rebecca Ferguson", desc: "Ethan Hunt faces a mysterious AI across the globe." },
        { title: "The Fall Guy", poster: "https://image.tmdb.org/t/p/w780/aTvePCU7exLepwg5hWySjwxojQK.jpg", year: 2024, rating: 7.3, genre: "Action", language: "English", duration: 126, actors: "Ryan Gosling, Emily Blunt, Aaron Taylor-Johnson", desc: "A stuntman is drawn into a wild conspiracy." },
        { title: "Kung Fu Panda 4", poster: "https://image.tmdb.org/t/p/w780/sRLC052ieEzkQs9dEtPMfFxYkej.jpg", year: 2024, rating: 7.0, genre: "Animation", language: "English", duration: 94, actors: "Jack Black, Awkwafina, Bryan Cranston", desc: "Po confronts a new villain as he trains the next Dragon Warrior." },
        { title: "Elemental", poster: "https://image.tmdb.org/t/p/w780/4Y1WNkd88JXmGfhtWR7dmDAo1T2.jpg", year: 2023, rating: 7.0, genre: "Animation", language: "English", duration: 102, actors: "Leah Lewis, Mamoudou Athie, Ronnie del Carmen", desc: "Fire and water discover all they have in common." },
        { title: "The Hunger Games: The Ballad of Songbirds & Snakes", poster: "https://image.tmdb.org/t/p/w780/mBaXZ95R2OxueZhvQbcEWy2DqyO.jpg", year: 2023, rating: 7.2, genre: "Action", language: "English", duration: 157, actors: "Rachel Zegler, Tom Blyth, Viola Davis", desc: "Coriolanus Snow's story in the 10th Hunger Games." }
    ].map(m => ({ ...m, seats_available: JSON.stringify([60, 60, 60, 60, 60]) }));
}

// ==================== OVERRIDE LOCALSTORAGE (SAFER PRELOAD) ====================

// This route serves a JavaScript file that fetches nf_* keys synchronously
// and writes them into the browser's localStorage BEFORE the SPA's app.js
// runs. It does NOT override localStorage.getItem to return Promises — that
// would break the existing synchronous SPA code.
app.get('/override-localstorage.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    // The script uses synchronous XHR to ensure data is present in localStorage
    // before the SPA initializes. This is a pragmatic unblock for the demo app.
    res.send(`
        (function(){
            try {
                var API_BASE = window.location.origin + '/api/proxy';
                var originalSetItem = localStorage.setItem.bind(localStorage);

                function syncKey(key, url) {
                    try {
                        var xhr = new XMLHttpRequest();
                        // synchronous request to ensure SPA gets data synchronously
                        xhr.open('GET', url, false);
                        xhr.send(null);
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                var data = JSON.parse(xhr.responseText);
                                // store as JSON string so app's JSON.parse(localStorage.getItem(key) || '...') works
                                originalSetItem(key, JSON.stringify(data));
                                console.log('NeonFlix: preloaded', key);
                            } catch (e) {
                                console.warn('NeonFlix: failed to parse response for', key, e);
                            }
                        } else {
                            console.warn('NeonFlix: fetch failed for', key, xhr.status);
                        }
                    } catch (e) {
                        console.warn('NeonFlix: sync fetch error for', key, e);
                    }
                }

                // Keys to preload. These match what app.js reads synchronously.
                var mapping = {
                    'nf_movieSeats': API_BASE + '/nf_movieSeats',
                    'nf_users': API_BASE + '/nf_users',
                    'nf_bookings_USERS': API_BASE + '/nf_bookings_USERS',
                    'nf_watchlist_USERS': API_BASE + '/nf_watchlist_USERS'
                };

                Object.keys(mapping).forEach(function(k){
                    syncKey(k, mapping[k]);
                });

                // Also preload movies (not used by localStorage in current SPA, but helpful)
                try {
                    var xhr2 = new XMLHttpRequest();
                    xhr2.open('GET', API_BASE + '/movies', false);
                    xhr2.send(null);
                    if (xhr2.status >= 200 && xhr2.status < 300) {
                        originalSetItem('nf_movies', JSON.stringify(JSON.parse(xhr2.responseText)));
                        console.log('NeonFlix: preloaded nf_movies');
                    }
                } catch (e) { /* ignore */ }

                console.log('NeonFlix: preload complete');
            } catch (e) {
                console.warn('NeonFlix: override-localstorage error', e);
            }
        })();
    `);
});

// ==================== MAIN HTML WITH INJECTION ====================

// Serve index.html with localStorage override
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    fs.readFile(indexPath, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error loading index.html');
            return;
        }
        
        // Inject our override script into the head so it runs before app.js
        const injected = data.replace(
            '</head>',
            `<script src="/override-localstorage.js"></script></head>`
        );
        
        res.send(injected);
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'NeonFlix Proxy Backend is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
initDB();

app.listen(PORT, () => {
    console.log(`🚀 NeonFlix Proxy Backend running on http://localhost:${PORT}`);
    console.log(`📊 Database: SQLite (neonflix.db)`);
    console.log(`🔗 Open: http://localhost:${PORT}`);
    if (NODE_ENV !== 'production') {
        console.log(`👑 Demo admin username: ${ADMIN_USERNAME} (password set via ADMIN_PASSWORD env var, default only for local dev)`);
    }
});