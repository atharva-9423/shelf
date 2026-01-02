# Shelf - Ebook Library App

## Overview
Shelf is a mobile-first ebook library app with a modern, warm UI design. Upload and manage your ebook collection with an intuitive interface.

## Features
- **Home Screen**: Greeting, horizontal book carousel, continue reading section
- **Trending Library View**: Grid view of all uploaded books
- **Admin Panel**: Password-protected area for uploading and managing ebooks
- **PDF Viewer**: Integrated PDF viewing in-browser
- **EPUB Support**: Download support for EPUB files
- **Firebase RTDB**: Cloud storage for books with real-time sync
- **Continue Reading**: Tracks your last read book with progress display
- **User Authentication**: Registration with approval system
- **Credential-Based Login**: Auto-generated username and password for approved users

## Project Structure
```
/
├── index.html          # Main HTML with all views including login page
├── style.css           # Mobile-first CSS styles
├── script.js           # Vanilla JS with IndexedDB for storage
├── admin.html          # Admin panel
├── admin.js            # Admin functionality
├── admin-style.css     # Admin panel styling
├── emailjs.md          # EmailJS setup instructions
├── vite.config.js      # Vite dev server configuration
└── attached_assets/    # Branding assets
```

## Tech Stack
- Vanilla HTML5
- Vanilla CSS3 (no preprocessors)
- Vanilla JavaScript (no frameworks)
- Vite (dev server only)
- Firebase Realtime Database (cloud storage)

## User Authentication & Login Flow
- **Registration Required**: Users must register before accessing the library
- **Registration Form**: Name, Email, and College Name
- **Approval Process**: 
  1. User submits registration with all details
  2. Admin reviews pending registrations in admin panel
  3. Admin approves user → System auto-generates random ID and password
  4. Admin sees credentials modal with copy buttons
  5. Approved user redirected to login page (not directly to app)
- **Login Page**: Approved users must enter their randomly generated credentials
  - User ID: Memorable format (e.g., `smart_john456`) - lowercase with adjectives
  - Password: 12-character secure password with letters, numbers, and special characters
  - After successful login, user gains access to library
- **Status Tracking**: User status tracked via localStorage and Firebase

## Admin Panel Features
- **Tabs**: Book Shelf, User Control, Approvals
- **Book Management**: Upload, view, and delete books
- **User Search**: Search approved users by name or email in User Control tab
- **Desktop Access Control**: Toggle to allow/disable desktop access
- **Approvals Tab**: Review pending registrations with user details
- **Auto-Generated Credentials**: When approving users, system generates unique ID and password with copy-to-clipboard functionality

## Admin Access
- **URL Access**: Open admin panel at `/admin.html` or by adding `?admin`, `#admin`, or `/admin` to the URL
  - Examples: `http://localhost:5000/admin.html` or `http://localhost:5000?admin`
- **Username**: `atharva_phatangare`
- **Password**: `atharva@1408`

## Design Features
- Mobile-first responsive design
- Warm cream background (#faf8f5)
- Horizontal book carousel on home screen
- Bottom navigation bar
- Continue reading section with progress bar
- Profile avatar, search, and notification icons in header
- Clean login form for credential entry

## Running the App
```bash
npm run dev
```
The app runs on port 5000.

## Firebase Data Structure (Optimized)
```
/book-meta/{bookId}/     # Metadata only (small, synced in real-time)
  - title
  - author
  - description
  - cover
  - fileName
  - createdAt

/book-files/{bookId}     # File data (large, fetched on-demand only)
  - base64 file content

/approved-users/{deviceId}/
  - name
  - email
  - college
  - deviceId
  - approvedAt
  - credentials/
    - id (generated username)
    - password (generated 12-char password)

/email-bindings/{emailKey}/
  - deviceId
  - email
  - approvedAt

/device-bindings/{deviceId}/
  - email
  - name
  - approvedAt

/pending-users/{deviceId}/
  - name
  - email
  - college
  - status (pending/approved/rejected)
  - submittedAt
  - deviceId
```

## Bandwidth Optimization
- Book metadata and file content are stored separately
- Only metadata is synced in real-time (small payload)
- File content is fetched on-demand when user opens a book
- Migration tool available in Admin panel to convert old books

## Local Caching System (Reduces Firebase Downloads)
The app implements a comprehensive local caching system to minimize Firebase RTDB downloads:

### Book Metadata (localStorage)
- Cached in localStorage under `shelf_books_cache`
- On app init, cached metadata loads instantly (no Firebase download)
- Firebase listener syncs in background and updates cache only when changes detected
- Offline mode: If Firebase fails, app falls back to cached data

### Book Files (IndexedDB)
- Large book files (PDFs, EPUBs) stored in IndexedDB `ShelfBooksDB`
- Background sync downloads ALL books on first app load
- New books auto-download when detected via Firebase listener
- Cache persists across browser sessions and page refreshes

## Device & Email Binding System
- **Email Uniqueness**: One email can only be registered on one device
- **Device Uniqueness**: One device can only have one registered account
- **Enforcement**: 
  - During registration: Checks if device/email already bound to different account
  - During approval: Creates bindings to prevent multi-device registration
  - Revocation: Clears all bindings when admin revokes access

## Recent Changes
- January 2, 2026: Added PWA support and Vercel deployment configuration
  - Created manifest.json and service-worker.js for offline use
  - Generated and linked PWA icons
  - Configured vercel.json for production deployment
  - Verified production build with Vite
- January 1, 2026: Added credential-based login system
  - Auto-generated usernames and passwords upon approval
  - Approved users redirected to login page instead of direct app access
  - Credentials validated before granting app access
  - User search added to User Control tab
  - Removal of Division, Branch, Year fields from registration
- December 18, 2025: Added user authentication and approval system
  - Users must register with Name, Email, and College
  - Admin can approve/reject registrations from Approvals tab
  - Auto-generated credentials with secure passwords
- December 8, 2025: Initial creation of Shelf ebook app
- December 12, 2025: Redesigned UI to match mobile app reference
- December 14, 2025: Integrated Firebase RTDB for cloud storage
- December 17, 2025: Bandwidth optimization with separate metadata and files
- December 18, 2025: Implemented comprehensive local caching system
