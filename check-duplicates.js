const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'ideas.db'));

// Check for duplicate ideas by content
db.all(`
    SELECT id, title, description, status, rating, type, user_id, created_at, updated_at
    FROM ideas
    ORDER BY created_at
`, [], (err, ideas) => {
    if (err) {
        console.error('Error getting ideas:', err);
        return;
    }

    console.log('\nChecking for duplicate ideas...');
    const duplicates = [];
    
    for (let i = 0; i < ideas.length; i++) {
        for (let j = i + 1; j < ideas.length; j++) {
            if (ideas[i].title === ideas[j].title && 
                ideas[i].description === ideas[j].description &&
                ideas[i].status === ideas[j].status &&
                ideas[i].rating === ideas[j].rating &&
                ideas[i].type === ideas[j].type &&
                ideas[i].user_id === ideas[j].user_id) {
                duplicates.push({
                    original: ideas[i],
                    duplicate: ideas[j]
                });
            }
        }
    }

    if (duplicates.length === 0) {
        console.log('No duplicate ideas found');
    } else {
        console.log(`Found ${duplicates.length} sets of duplicate ideas:`);
        duplicates.forEach(({original, duplicate}) => {
            console.log(`\nDuplicate set:`);
            console.log(`Original (ID: ${original.id}):`);
            console.log(`- Title: ${original.title}`);
            console.log(`- Created: ${original.created_at}`);
            console.log(`Duplicate (ID: ${duplicate.id}):`);
            console.log(`- Title: ${duplicate.title}`);
            console.log(`- Created: ${duplicate.created_at}`);
        });
    }
});

// Check for duplicate tasks
db.all(`
    SELECT t.id, t.task_name, t.task_due_date, t.task_status,
           t.task_completion_date, t.idea_id, i.title as idea_title
    FROM tasks t
    JOIN ideas i ON t.idea_id = i.id
    ORDER BY t.created_at
`, [], (err, tasks) => {
    if (err) {
        console.error('Error getting tasks:', err);
        return;
    }

    console.log('\nChecking for duplicate tasks...');
    const duplicates = [];
    
    for (let i = 0; i < tasks.length; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
            if (tasks[i].task_name === tasks[j].task_name && 
                tasks[i].task_due_date === tasks[j].task_due_date &&
                tasks[i].task_status === tasks[j].task_status &&
                tasks[i].idea_id === tasks[j].idea_id) {
                duplicates.push({
                    original: tasks[i],
                    duplicate: tasks[j]
                });
            }
        }
    }

    if (duplicates.length === 0) {
        console.log('No duplicate tasks found');
    } else {
        console.log(`Found ${duplicates.length} sets of duplicate tasks:`);
        duplicates.forEach(({original, duplicate}) => {
            console.log(`\nDuplicate set:`);
            console.log(`Original (ID: ${original.id}):`);
            console.log(`- Name: ${original.task_name}`);
            console.log(`- Status: ${original.task_status}`);
            console.log(`- Idea: ${original.idea_title}`);
            console.log(`Duplicate (ID: ${duplicate.id}):`);
            console.log(`- Name: ${duplicate.task_name}`);
            console.log(`- Status: ${duplicate.task_status}`);
            console.log(`- Idea: ${duplicate.idea_title}`);
        });
    }
});

// Get total counts
db.get('SELECT COUNT(*) as count FROM ideas', [], (err, row) => {
    if (err) {
        console.error('Error counting ideas:', err);
        return;
    }
    console.log(`\nTotal ideas in database: ${row.count}`);
});

db.get('SELECT COUNT(*) as count FROM tasks', [], (err, row) => {
    if (err) {
        console.error('Error counting tasks:', err);
        return;
    }
    console.log(`Total tasks in database: ${row.count}`);
}); 