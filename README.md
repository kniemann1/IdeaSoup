# IdeaSoup

A web application to help Capture, Prioritize, and Manage tasks for All your great ideas.

## Overview

IdeaSoup is a Node.js application that helps you track and manage your product ideas using SQLite as the database. It provides a modern web interface for creating, organizing, and tracking the progress of your ideas and their associated tasks.

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
- user_id (INTEGER, NOT NULL)
- title (TEXT, NOT NULL)
- description (TEXT)
- status (TEXT, DEFAULT 'To Do')
- rating (INTEGER, DEFAULT 0)
- type (TEXT)
- created_at (DATETIME)
- updated_at (DATETIME)

### Tasks Table
- id (INTEGER, PRIMARY KEY)
- idea_id (INTEGER, FOREIGN KEY)
- name (TEXT, NOT NULL)
- description (TEXT)
- due_date (TEXT)
- status (TEXT, DEFAULT 'To Do')
- created_at (DATETIME)
- updated_at (DATETIME)

### Users Table
- id (INTEGER, PRIMARY KEY)
- google_id (TEXT, UNIQUE, NOT NULL)
- email (TEXT, UNIQUE, NOT NULL)
- display_name (TEXT)
- profile_picture (TEXT)
- created_at (DATETIME)

## Features

- Google OAuth authentication
- Create and manage ideas
- Add tasks to ideas
- Track progress with status updates
- Rate and categorize ideas
- Modern, responsive UI

## Development

The database file (ideas.db) will be automatically created when you first run the application. The schema is initialized in the `server.js` file.
