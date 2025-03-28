const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'ideas.db'));

// First, get Karl's user ID
db.get('SELECT id FROM users WHERE email = ?', ['karl.niemann@gmail.com'], (err, karlUser) => {
    if (err) {
        console.error('Error getting Karl user:', err);
        return;
    }

    console.log(`Found Karl's user ID: ${karlUser.id}`);

    // Get all ideas owned by Karl
    db.all('SELECT id FROM ideas WHERE user_id = ?', [karlUser.id], (err, ideas) => {
        if (err) {
            console.error('Error getting Karl\'s ideas:', err);
            return;
        }

        const ideaIds = ideas.map(idea => idea.id);
        console.log(`Found ${ideaIds.length} ideas owned by Karl`);

        // First, count all tasks
        db.get('SELECT COUNT(*) as count FROM tasks', [], (err, row) => {
            if (err) {
                console.error('Error counting total tasks:', err);
                return;
            }
            console.log(`Total tasks in database: ${row.count}`);

            // Update tasks to ensure they're linked to Karl's ideas
            db.run(`UPDATE tasks 
                    SET idea_id = NULL 
                    WHERE idea_id NOT IN (${ideaIds.join(',')})`, [], (err) => {
                if (err) {
                    console.error('Error updating tasks:', err);
                    return;
                }

                // Count remaining tasks
                db.get('SELECT COUNT(*) as count FROM tasks WHERE idea_id IS NOT NULL', [], (err, row) => {
                    if (err) {
                        console.error('Error counting remaining tasks:', err);
                        return;
                    }
                    console.log(`Tasks now properly linked to Karl's ideas: ${row.count}`);
                });
            });
        });
    });
}); 