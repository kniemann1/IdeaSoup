const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Database setup
const db = new sqlite3.Database(path.join(__dirname, '..', 'ideas.db'));

// Configure session middleware
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

// Configure Passport
function configurePassport(app) {
    // Initialize Passport and restore authentication state from session
    app.use(passport.initialize());
    app.use(passport.session());

    // Serialize user for the session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from the session
    passport.deserializeUser((id, done) => {
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
            if (err) {
                return done(err, null);
            }
            done(null, user);
        });
    });

    // Configure Google OAuth Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists
            db.get('SELECT * FROM users WHERE google_id = ?', [profile.id], (err, existingUser) => {
                if (err) {
                    return done(err, null);
                }

                if (existingUser) {
                    // Update user information
                    db.run(`UPDATE users 
                           SET email = ?, display_name = ?, profile_picture = ? 
                           WHERE google_id = ?`,
                        [profile.emails[0].value, profile.displayName, profile.photos[0].value, profile.id],
                        (err) => {
                            if (err) {
                                return done(err, null);
                            }
                            return done(null, existingUser);
                        }
                    );
                } else {
                    // Create new user
                    db.run(`INSERT INTO users (google_id, email, display_name, profile_picture) 
                           VALUES (?, ?, ?, ?)`,
                        [profile.id, profile.emails[0].value, profile.displayName, profile.photos[0].value],
                        function(err) {
                            if (err) {
                                return done(err, null);
                            }
                            const newUser = {
                                id: this.lastID,
                                google_id: profile.id,
                                email: profile.emails[0].value,
                                display_name: profile.displayName,
                                profile_picture: profile.photos[0].value
                            };
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