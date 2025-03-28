const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'ideas.db'));

// First, get the current user's ID
db.get('SELECT id FROM users ORDER BY created_at DESC LIMIT 1', [], (err, user) => {
    if (err) {
        console.error('Error getting user:', err);
        return;
    }

    if (!user) {
        console.log('No user found in database');
        return;
    }

    console.log(`Found user with ID: ${user.id}`);

    // Update all ideas that don't have a user_id to be associated with this user
    db.run(`UPDATE ideas SET user_id = ? WHERE user_id IS NULL`, [user.id], function(err) {
        if (err) {
            console.error('Error updating ideas:', err);
            return;
        }
        console.log(`Updated ${this.changes} ideas to be associated with user ${user.id}`);

        // Verify the update
        db.get('SELECT COUNT(*) as count FROM ideas WHERE user_id = ?', [user.id], (err, row) => {
            if (err) {
                console.error('Error counting ideas:', err);
                return;
            }
            console.log(`Total ideas now associated with user ${user.id}: ${row.count}`);
        });
    });
}); 