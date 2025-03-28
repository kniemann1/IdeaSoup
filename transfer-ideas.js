const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'ideas.db'));

// First, get the user IDs
db.get('SELECT id FROM users WHERE email = ?', ['default@example.com'], (err, defaultUser) => {
    if (err) {
        console.error('Error getting default user:', err);
        return;
    }

    db.get('SELECT id FROM users WHERE email = ?', ['karl.niemann@gmail.com'], (err, karlUser) => {
        if (err) {
            console.error('Error getting Karl user:', err);
            return;
        }

        // Update all ideas owned by default user to be owned by Karl
        db.run('UPDATE ideas SET user_id = ? WHERE user_id = ?', 
            [karlUser.id, defaultUser.id], 
            function(err) {
                if (err) {
                    console.error('Error updating ideas:', err);
                    return;
                }
                console.log(`Transferred ${this.changes} ideas from Default User to Karl Niemann`);

                // Verify the transfer
                db.all('SELECT COUNT(*) as count FROM ideas WHERE user_id = ?', [karlUser.id], (err, rows) => {
                    if (err) {
                        console.error('Error verifying transfer:', err);
                        return;
                    }
                    console.log(`Total ideas now owned by Karl Niemann: ${rows[0].count}`);
                });
            }
        );
    });
}); 