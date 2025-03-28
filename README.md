# IdeaSoup - Product Idea Tracking Application

A Node.js application for tracking product ideas using SQLite as the database.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
node server.js
```

## Database Schema

The application uses SQLite with the following tables:

### Ideas Table
- id (INTEGER, PRIMARY KEY)
- title (TEXT, NOT NULL)
- description (TEXT)
- status (TEXT, DEFAULT 'draft')
- created_at (DATETIME)
- updated_at (DATETIME)

### Tags Table
- id (INTEGER, PRIMARY KEY)
- name (TEXT, NOT NULL, UNIQUE)

### Idea_Tags Table (Junction Table)
- idea_id (INTEGER, FOREIGN KEY)
- tag_id (INTEGER, FOREIGN KEY)

## API Endpoints

- GET /test - Test database connection

## Development

The database file (ideas.db) will be automatically created when you first run the application. The schema is initialized in the `db.js` file. 