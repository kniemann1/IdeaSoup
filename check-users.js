const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'ideas.db'));

db.all('SELECT display_name, email FROM users', [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('Users in database:');
    rows.forEach(row => {
        console.log(`Name: ${row.display_name}, Email: ${row.email}`);
    });
    db.close();
}); 