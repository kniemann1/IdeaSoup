const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Create data directory if it doesn't exist
const dataDir = process.env.NODE_ENV === 'production' ? '/data' : '.';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Database setup
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/data/ideas.db'  // Use persistent storage in production (Render)
    : path.join(__dirname, '..', 'ideas.db');

const db = new sqlite3.Database(dbPath);

// Configure session middleware
const sessionMiddleware = session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: process.env.NODE_ENV === 'production' ? '/data' : '.',
        concurrentDB: true,
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'production' ? 'ideasoup.onrender.com' : undefined
    },
    name: 'sessionId'
});

// Add session logging middleware
const sessionLoggingMiddleware = (req, res, next) => {
    console.log('Session:', {
        id: req.sessionID,
        cookie: req.session.cookie,
        user: req.user,
        isAuthenticated: req.isAuthenticated(),
        passport: req.session.passport
    });
    next();
};

// Configure Passport
function configurePassport(app) {
    // Initialize Passport and restore authentication state from session
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(sessionLoggingMiddleware);

    // Serialize user for the session
    passport.serializeUser((user, done) => {
        console.log('Serializing user:', user.id);
        done(null, user.id);
    });

    // Deserialize user from the session
    passport.deserializeUser((id, done) => {
        console.log('Deserializing user:', id);
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
            if (err) {
                console.error('Error deserializing user:', err);
                return done(err, null);
            }
            console.log('Deserialized user:', user);
            done(null, user);
        });
    });

    // Configure Google OAuth Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.NODE_ENV === 'production'
            ? 'https://ideasoup.onrender.com/auth/google/callback'
            : 'http://localhost:3001/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
        console.log('Google OAuth callback received profile:', {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            displayName: profile.displayName
        });
        try {
            // Get user from database
            db.get('SELECT * FROM users WHERE google_id = ?', [profile.id], (err, user) => {
                if (err) {
                    return done(err);
                }

                if (user) {
                    console.log('Found existing user:', user);
                    // Update user information
                    db.run(`UPDATE users 
                           SET email = ?, display_name = ?, profile_picture = ? 
                           WHERE google_id = ?`,
                        [profile.emails[0].value, profile.displayName, profile.photos[0].value, profile.id],
                        (err) => {
                            if (err) {
                                console.error('Error updating user:', err);
                                return done(err, null);
                            }
                            console.log('Successfully updated user');
                            return done(null, user);
                        }
                    );
                } else {
                    console.log('Creating new user');
                    // Create new user
                    db.run(`INSERT INTO users (google_id, email, display_name, profile_picture) 
                           VALUES (?, ?, ?, ?)`,
                        [profile.id, profile.emails[0].value, profile.displayName, profile.photos[0].value],
                        function(err) {
                            if (err) {
                                console.error('Error creating new user:', err);
                                return done(err, null);
                            }
                            const newUser = {
                                id: this.lastID,
                                google_id: profile.id,
                                email: profile.emails[0].value,
                                display_name: profile.displayName,
                                profile_picture: profile.photos[0].value
                            };
                            console.log('Successfully created new user:', newUser);
                            return done(null, newUser);
                        }
                    );
                }
            });
        } catch (error) {
            return done(error, null);
        }
    }));
}

module.exports = {
    configurePassport,
    sessionMiddleware
}; 