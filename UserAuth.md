You are an expert in Google Oauth and SqlLite

Your job is to add to the existing app User authentication with  the following features:
1. User authentication using Google OAuth
2. Change the SqlLite schema to add a layer of user ownership of Ideas stores




 
1. Dependencies and Setup##

Add required npm packages:

passport for authentication middleware
passport-google-oauth20 for Google OAuth strategy
express-session for session management
dotenv for environment variables

2. Database Schema Modifications##
Add new tables to the SQLite database:

-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    profile_picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add user_id to ideas table
ALTER TABLE ideas ADD COLUMN user_id INTEGER;
ALTER TABLE ideas ADD FOREIGN KEY (user_id) REFERENCES users(id);

3. Authentication Configuration
Create a new file config/auth.js for authentication setup:
Configure Passport.js
Set up Google OAuth strategy
Configure session middleware
Define authentication routes
Set up environment variables in .env:
Apply to UserAuth.md


4. Server-side Implementation
    Modify server.js:
        Add authentication middleware
        Create protected routes
        Add user context to requests
        Implement logout functionality
Create new routes:
    /auth/google - Initiates Google OAuth flow
    /auth/google/callback - Handles OAuth callback
    /auth/logout - Handles user logout
    /api/user - Returns current user info
5. Frontend Implementation
    Add login/logout buttons to the UI
    Create authentication state management
    Modify API calls to include authentication
    Add user profile display
6. Security Considerations
    Implement CSRF protection
    Set secure session cookies
    Add rate limiting for auth routes
    Implement proper error handling
    Add input validation
7. User Experience
    Add loading states during authentication
    Implement proper error messages
    Add "Remember me" functionality
    Create user profile page
    Add proper redirects after login/logout
8. Testing Requirements
    Unit tests for authentication logic
    Integration tests for OAuth flow
    Security testing for protected routes
    User session management tests
9. Documentation
    Update README with setup instructions
    Document environment variables
    Add API documentation for auth endpoints
    Create user guide for authentication
Implementation Order
    Set up dependencies and configuration
    Implement database schema changes
    Create authentication middleware
    Implement Google OAuth flow
    Add protected routes
    Update frontend components
    Add security measures
    Implement testing
    Update documentation
Would you like me to start implementing any specific part of this plan? I can begin with setting up the dependencies and creating the database schema modifications.

