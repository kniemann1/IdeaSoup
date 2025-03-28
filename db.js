const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create a new database instance
const db = new sqlite3.Database(path.join(__dirname, 'ideas.db'), (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Initialize database schema
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            try {
                // Create ideas table with new rating and type fields
                db.run(`CREATE TABLE IF NOT EXISTS ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Done', 'Archived')),
                    rating INTEGER DEFAULT 50 CHECK (rating >= 1 AND rating <= 100),
                    type TEXT CHECK (type IN ('WebApp', 'Software', 'Embedded', 'Physical Product', 'Service')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Migrate existing status values
                db.run(`UPDATE ideas SET status = 'To Do' WHERE status = 'draft'`);
                db.run(`UPDATE ideas SET status = 'In Progress' WHERE status = 'in-progress'`);
                db.run(`UPDATE ideas SET status = 'Done' WHERE status = 'completed'`);
                db.run(`UPDATE ideas SET status = 'Archived' WHERE status = 'archived'`);

                // Create tags table
                db.run(`CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE
                )`);

                // Create idea_tags junction table for many-to-many relationship
                db.run(`CREATE TABLE IF NOT EXISTS idea_tags (
                    idea_id INTEGER,
                    tag_id INTEGER,
                    FOREIGN KEY (idea_id) REFERENCES ideas (id) ON DELETE CASCADE,
                    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
                    PRIMARY KEY (idea_id, tag_id)
                )`);

                // Create tasks table for todo items
                db.run(`CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    idea_id INTEGER NOT NULL,
                    task_name TEXT NOT NULL,
                    task_due_date DATETIME,
                    task_status TEXT DEFAULT 'To Do' CHECK (task_status IN ('To Do', 'In Progress', 'Done')),
                    task_completion_date DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (idea_id) REFERENCES ideas (id) ON DELETE CASCADE
                )`, [], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database schema initialized');
                        resolve();
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    });
}

// Initialize the database when this module is imported
initializeDatabase()
    .catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

module.exports = db; 