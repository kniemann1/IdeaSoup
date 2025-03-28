const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { configurePassport, sessionMiddleware } = require('./config/auth');
const passport = require('passport');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Create data directory if it doesn't exist
const dataDir = process.env.NODE_ENV === 'production' ? path.join(__dirname) : '.';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Trust proxy for secure cookies
app.set('trust proxy', 1);

// Global error handler
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: err.message || 'Something went wrong'
    });
};

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Session and Passport middleware must be in this order
app.use(sessionMiddleware);
configurePassport(app);

// Add a middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Authentication Routes
app.get('/auth/google',
    (req, res, next) => {
        console.log('Starting Google OAuth flow...');
        passport.authenticate('google', { 
            scope: ['profile', 'email'],
            prompt: 'select_account'  // Force account selection
        })(req, res, next);
    }
);

app.get('/auth/google/callback',
    (req, res, next) => {
        console.log('Received Google OAuth callback');
        passport.authenticate('google', { 
            failureRedirect: '/login',
            failureMessage: true
        })(req, res, next);
    },
    (req, res) => {
        console.log('OAuth successful, user:', req.user);
        // Ensure session is saved before redirect
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
            }
            res.redirect('/');
        });
    }
);

app.get('/auth/logout', (req, res) => {
    console.log('Logging out user:', req.user);
    req.logout(() => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.redirect('/');
        });
    });
});

app.get('/api/user', (req, res) => {
    console.log('User endpoint called. User:', req.user);
    res.json(req.user || null);
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// Protect API routes
app.use('/api/ideas', isAuthenticated);
app.use('/api/tasks', isAuthenticated);

// Database setup
const dbPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, 'ideas.db')  // Use project root in production (Render)
    : 'ideas.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        return;
    }
    console.log('Connected to SQLite database');
    initializeDatabase();
});

// Initialize database schema
function initializeDatabase() {
    db.serialize(() => {
        // Create users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            display_name TEXT,
            profile_picture TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            }
        });

        // Create tasks table with correct schema
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            idea_id INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            due_date TEXT,
            status TEXT DEFAULT 'To Do',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) {
                console.error('Error creating tasks table:', err);
            } else {
                console.log('Tasks table initialized');
            }
        });

        // Create ideas table with user_id
        db.run(`CREATE TABLE IF NOT EXISTS ideas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'To Do',
            rating INTEGER DEFAULT 0,
            type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) {
                console.error('Error creating ideas table:', err);
            }
        });

        // Migrate existing data if needed
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='ideas'", (err, row) => {
            if (err) {
                console.error('Error checking ideas table:', err);
                return;
            }
            if (row) {
                // Check if user_id column exists
                db.all("PRAGMA table_info(ideas)", (err, columns) => {
                    if (err) {
                        console.error('Error checking ideas table columns:', err);
                        return;
                    }
                    const hasUserId = Array.isArray(columns) && columns.some(col => col.name === 'user_id');
                    if (!hasUserId) {
                        // Add user_id column and set default user
                        db.run(`ALTER TABLE ideas ADD COLUMN user_id INTEGER`, (err) => {
                            if (err) {
                                console.error('Error adding user_id column:', err);
                                return;
                            }
                            // Create a default user for existing data
                            db.run(`INSERT INTO users (google_id, email, display_name) 
                                   VALUES ('default', 'default@example.com', 'Default User')`, (err) => {
                                if (err) {
                                    console.error('Error creating default user:', err);
                                    return;
                                }
                                // Get the default user's ID
                                db.get('SELECT id FROM users WHERE google_id = ?', ['default'], (err, user) => {
                                    if (err) {
                                        console.error('Error getting default user:', err);
                                        return;
                                    }
                                    // Update existing ideas with the default user
                                    db.run('UPDATE ideas SET user_id = ? WHERE user_id IS NULL', [user.id], (err) => {
                                        if (err) {
                                            console.error('Error updating existing ideas:', err);
                                        }
                                    });
                                });
                            });
                        });
                    }
                });
            }
        });
    });
    console.log('Database schema initialized');
}

// API Routes
app.get('/api/ideas', (req, res, next) => {
    console.log('Ideas endpoint called. User:', req.user);
    if (!req.user || !req.user.id) {
        console.log('No authenticated user found');
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    db.all('SELECT * FROM ideas WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            next(err);
            return;
        }
        console.log(`Found ${rows.length} ideas for user ${req.user.id}`);
        res.json(rows);
    });
});

// Add endpoint to get a single idea
app.get('/api/ideas/:id', (req, res, next) => {
    const { id } = req.params;
    console.log('Fetching idea:', id, 'for user:', req.user.id);

    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.get('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [id, req.user.id], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            next(err);
            return;
        }
        if (!row) {
            console.log('Idea not found or access denied');
            return res.status(404).json({ error: 'Idea not found or access denied' });
        }
        console.log('Found idea:', row);
        res.json(row);
    });
});

app.post('/api/ideas', (req, res, next) => {
    const { title, description, status, rating, type } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    const sql = `INSERT INTO ideas (user_id, title, description, status, rating, type) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [req.user.id, title, description, status || 'To Do', rating || 0, type], function(err) {
        if (err) {
            next(err);
            return;
        }
        db.get('SELECT * FROM ideas WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
                next(err);
                return;
            }
            res.status(201).json(row);
        });
    });
});

app.patch('/api/ideas/:id', (req, res, next) => {
    const { id } = req.params;
    const updates = req.body;
    console.log('Received update request:', { id, updates });

    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }

    // First check if the idea belongs to the user
    db.get('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [id, req.user.id], (err, idea) => {
        if (err) {
            next(err);
            return;
        }
        if (!idea) {
            return res.status(404).json({ error: 'Idea not found or access denied' });
        }

        const setClause = Object.keys(updates)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(updates), id];
        const sql = `UPDATE ideas SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;

        db.run(sql, [...values, req.user.id], function(err) {
            if (err) {
                next(err);
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Idea not found' });
            }
            db.get('SELECT * FROM ideas WHERE id = ?', [id], (err, row) => {
                if (err) {
                    next(err);
                    return;
                }
                console.log('Successfully updated idea:', row);
                res.json(row);
            });
        });
    });
});

app.delete('/api/ideas/:id', (req, res, next) => {
    const { id } = req.params;
    db.run('DELETE FROM ideas WHERE id = ? AND user_id = ?', [id, req.user.id], function(err) {
        if (err) {
            next(err);
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Idea not found or access denied' });
        }
        res.status(204).send();
    });
});

// Task routes
app.get('/api/ideas/:ideaId/tasks', (req, res, next) => {
    const { ideaId } = req.params;
    // First check if the idea belongs to the user
    db.get('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [ideaId, req.user.id], (err, idea) => {
        if (err) {
            next(err);
            return;
        }
        if (!idea) {
            return res.status(404).json({ error: 'Idea not found or access denied' });
        }
        db.all('SELECT * FROM tasks WHERE idea_id = ? ORDER BY created_at DESC', [ideaId], (err, rows) => {
            if (err) {
                next(err);
                return;
            }
            res.json(rows);
        });
    });
});

app.post('/api/ideas/:ideaId/tasks', (req, res, next) => {
    const { ideaId } = req.params;
    const { name, description, due_date, status } = req.body;
    console.log('Creating task:', { ideaId, name, description, due_date, status });

    if (!name) {
        return res.status(400).json({ error: 'Task name is required' });
    }

    // First check if the idea belongs to the user
    db.get('SELECT * FROM ideas WHERE id = ? AND user_id = ?', [ideaId, req.user.id], (err, idea) => {
        if (err) {
            console.error('Error checking idea ownership:', err);
            next(err);
            return;
        }
        if (!idea) {
            console.log('Idea not found or access denied:', { ideaId, userId: req.user.id });
            return res.status(404).json({ error: 'Idea not found or access denied' });
        }

        // Enable foreign key constraints
        db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) {
                console.error('Error enabling foreign keys:', err);
                next(err);
                return;
            }

            const sql = `INSERT INTO tasks (idea_id, name, description, due_date, status) 
                         VALUES (?, ?, ?, ?, ?)`;
            
            const values = [ideaId, name, description, due_date, status || 'To Do'];
            console.log('Executing SQL:', sql);
            console.log('With values:', values);
            
            db.run(sql, values, function(err) {
                if (err) {
                    console.error('Error inserting task:', err);
                    console.error('SQL:', sql);
                    console.error('Values:', values);
                    next(err);
                    return;
                }
                console.log('Task inserted successfully, lastID:', this.lastID);
                
                db.get('SELECT * FROM tasks WHERE id = ?', [this.lastID], (err, row) => {
                    if (err) {
                        console.error('Error fetching created task:', err);
                        next(err);
                        return;
                    }
                    console.log('Created task:', row);
                    res.status(201).json(row);
                });
            });
        });
    });
});

app.patch('/api/tasks/:taskId', (req, res, next) => {
    const { taskId } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }

    // First check if the task belongs to a user's idea
    db.get(`SELECT t.* FROM tasks t 
            JOIN ideas i ON t.idea_id = i.id 
            WHERE t.id = ? AND i.user_id = ?`, [taskId, req.user.id], (err, task) => {
        if (err) {
            next(err);
            return;
        }
        if (!task) {
            return res.status(404).json({ error: 'Task not found or access denied' });
        }

        const setClause = Object.keys(updates)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(updates), taskId];
        const sql = `UPDATE tasks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        db.run(sql, values, function(err) {
            if (err) {
                next(err);
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }
            db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
                if (err) {
                    next(err);
                    return;
                }
                res.json(row);
            });
        });
    });
});

app.delete('/api/tasks/:taskId', (req, res, next) => {
    const { taskId } = req.params;
    // First check if the task belongs to a user's idea
    db.get(`SELECT t.* FROM tasks t 
            JOIN ideas i ON t.idea_id = i.id 
            WHERE t.id = ? AND i.user_id = ?`, [taskId, req.user.id], (err, task) => {
        if (err) {
            next(err);
            return;
        }
        if (!task) {
            return res.status(404).json({ error: 'Task not found or access denied' });
        }
        db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
            if (err) {
                next(err);
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Task not found' });
            }
            res.status(204).send();
        });
    });
});

// Backup and Restore endpoints
app.get('/api/backup', (req, res, next) => {
    // Get all ideas and tasks for the current user
    db.all(`
        SELECT i.*, 
               GROUP_CONCAT(DISTINCT t.id) as task_ids,
               GROUP_CONCAT(DISTINCT t.name) as task_names,
               GROUP_CONCAT(DISTINCT t.description) as task_descriptions,
               GROUP_CONCAT(DISTINCT t.due_date) as task_due_dates,
               GROUP_CONCAT(DISTINCT t.status) as task_statuses
        FROM ideas i
        LEFT JOIN tasks t ON i.id = t.idea_id
        WHERE i.user_id = ?
        GROUP BY i.id
    `, [req.user.id], (err, rows) => {
        if (err) {
            next(err);
            return;
        }

        // Format the data for backup
        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            ideas: rows.map(row => {
                const idea = {
                    title: row.title,
                    description: row.description,
                    status: row.status,
                    rating: row.rating,
                    type: row.type,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    tasks: []
                };

                // Parse task data if it exists and is not null
                if (row.task_ids && row.task_names && row.task_descriptions && row.task_due_dates && row.task_statuses) {
                    const taskIds = row.task_ids.split(',');
                    const taskNames = row.task_names.split(',');
                    const taskDescriptions = row.task_descriptions.split(',');
                    const taskDueDates = row.task_due_dates.split(',');
                    const taskStatuses = row.task_statuses.split(',');

                    // Only add tasks if we have valid data
                    if (taskIds.length > 0 && taskIds[0] !== '') {
                        taskIds.forEach((taskId, index) => {
                            if (taskId && taskNames[index]) {
                                idea.tasks.push({
                                    name: taskNames[index],
                                    description: taskDescriptions[index] || '',
                                    due_date: taskDueDates[index] || null,
                                    status: taskStatuses[index] || 'To Do'
                                });
                            }
                        });
                    }
                }

                return idea;
            })
        };

        res.json(backupData);
    });
});

app.post('/api/restore', (req, res, next) => {
    const backupData = req.body;

    // Validate backup data
    if (!backupData.version || !backupData.ideas || !Array.isArray(backupData.ideas)) {
        return res.status(400).json({ error: 'Invalid backup data format' });
    }

    // Start a transaction
    db.serialize(() => {
        // First, delete existing data
        db.run('DELETE FROM tasks WHERE idea_id IN (SELECT id FROM ideas WHERE user_id = ?)', [req.user.id], (err) => {
            if (err) {
                next(err);
                return;
            }

            db.run('DELETE FROM ideas WHERE user_id = ?', [req.user.id], (err) => {
                if (err) {
                    next(err);
                    return;
                }

                // Insert new ideas and tasks
                let completedIdeas = 0;
                let completedTasks = 0;

                backupData.ideas.forEach(idea => {
                    db.run(`
                        INSERT INTO ideas (user_id, title, description, status, rating, type, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        req.user.id,
                        idea.title,
                        idea.description,
                        idea.status,
                        idea.rating,
                        idea.type,
                        idea.created_at,
                        idea.updated_at
                    ], function(err) {
                        if (err) {
                            next(err);
                            return;
                        }

                        const ideaId = this.lastID;
                        completedIdeas++;

                        // Insert tasks for this idea
                        if (idea.tasks && Array.isArray(idea.tasks)) {
                            let taskCount = 0;
                            idea.tasks.forEach(task => {
                                db.run(`
                                    INSERT INTO tasks (idea_id, name, description, due_date, status)
                                    VALUES (?, ?, ?, ?, ?)
                                `, [
                                    ideaId,
                                    task.name,
                                    task.description,
                                    task.due_date,
                                    task.status
                                ], (err) => {
                                    if (err) {
                                        next(err);
                                        return;
                                    }
                                    taskCount++;
                                    completedTasks++;

                                    // If all tasks for this idea are done and this is the last idea
                                    if (taskCount === idea.tasks.length && completedIdeas === backupData.ideas.length) {
                                        res.json({
                                            message: 'Backup restored successfully',
                                            ideasRestored: completedIdeas,
                                            tasksRestored: completedTasks
                                        });
                                    }
                                });
                            });
                        } else {
                            completedTasks++;
                            // If this is the last idea and it has no tasks
                            if (completedIdeas === backupData.ideas.length) {
                                res.json({
                                    message: 'Backup restored successfully',
                                    ideasRestored: completedIdeas,
                                    tasksRestored: completedTasks
                                });
                            }
                        }
                    });
                });
            });
        });
    });
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Apply error handling middleware
app.use(errorHandler);

// Start server with error handling
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}).on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't exit the process, let it continue running
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, let it continue running
}); 