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

## Project Structure
```
/
├── index.html          # Main HTML with all views
├── style.css           # Mobile-first CSS styles
├── script.js           # Vanilla JS with IndexedDB for storage
├── vite.config.js      # Vite dev server configuration
└── attached_assets/    # Branding assets
```

## Tech Stack
- Vanilla HTML5
- Vanilla CSS3 (no preprocessors)
- Vanilla JavaScript (no frameworks)
- Vite (dev server only)
- Firebase Realtime Database (cloud storage)

## User Authentication
- **Registration Required**: Users must register before accessing the library
- **Registration Form**: Name, Division, Branch, Year, and ID Card Photo upload
- **Approval Process**: 
  1. User submits registration with all details
  2. Admin reviews pending registrations in admin panel
  3. Admin approves or rejects user
  4. If approved, user automatically gets access to the library
- **Status Tracking**: User status tracked via localStorage and Firebase (pending/approved/rejected)

## Admin Access
- **URL Access**: Open admin panel at `/admin.html` or by adding `?admin`, `#admin`, or `/admin` to the URL
  - Examples: `http://localhost:5000/admin.html` or `http://localhost:5000?admin`
  - Will automatically redirect to admin page
  - If not logged in, will show admin login form
  - If logged in, will directly show admin dashboard
- **Username**: `atharva_phatangare`
- **Password**: `atharva@1408`
- **Approvals Tab**: Review and approve/reject pending user registrations
  - View user details: Name, Division, Branch, Year
  - View uploaded ID card image
  - Approve or reject with one click
- **Note**: This is client-side authentication only (as no backend was requested)

## Design Features
- Mobile-first responsive design
- Warm cream background (#faf8f5)
- Horizontal book carousel on home screen
- Bottom navigation bar
- Continue reading section with progress bar
- Profile avatar, search, and notification icons in header

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

### Background Sync System
- `syncAllBooksToCache()`: Downloads all book files in background on app init
- `syncNewBooks()`: Detects and downloads newly uploaded books automatically
- Throttled downloads (100ms delay) to avoid overwhelming the browser
- Progress shown via toast notifications
- Queue system prevents duplicate downloads

### How It Saves Downloads
1. First visit: Downloads all books in background and caches locally
2. Repeat visits: Loads from cache (0 bytes from Firebase if no changes)
3. New book uploaded: Auto-detected and downloaded once per device
4. Book deleted: Local caches cleaned up automatically
5. Offline: Full library available from cache

## Features - Book Detail Page
- **Book Information**: Shows author, language, and page count
- **Bookmark Feature**: Toggle bookmark button to save favorite books
  - Click bookmark icon to add/remove books from bookmarks
  - Bookmarks are saved in localStorage
  - Full icon indicates bookmarked, outline indicates not bookmarked
  - Toast notification confirms action

## Features - Bottom Navigation
- **Three Main Sections**: Home, Library, Bookmarks
- **Header Visibility**: Main header (with logo, search, notifications) visible on:
  - Home page
  - Book detail page
  - Library page
  - Bookmarks page
- **Bookmarks View**: Dedicated section to view all bookmarked books
  - Shows grid of bookmarked books (same layout as library)
  - Header visible with search and other features
  - Click any book to view details or read
  - Empty state message when no bookmarks exist
  - Admin panel accessible via URL (?admin, #admin, /admin)
  - Removed admin login from bottom navigation for cleaner UI
- **Trending Library View**: Shows all available books in a grid
  - Header visible with search and other features
  - Click any book to view details or read
  - Displays trending/popular books collection

## Recent Changes
- December 18, 2025: Added user authentication and approval system
  - Users must register with Name, Division, Branch, Year, and ID Card photo
  - Admin can approve/reject registrations from Approvals tab
  - Auto-login after admin approval with real-time Firebase listener
  - Separate admin page (admin.html) for better security
- December 8, 2025: Initial creation of Shelf ebook app
- December 12, 2025: Redesigned UI to match mobile app reference
- Added horizontal book carousel
- Added continue reading section with progress tracking
- Added bottom navigation bar
- Implemented mobile-first responsive design
- December 14, 2025: Integrated Firebase RTDB for cloud storage
- Books uploaded from admin panel are now stored in Firebase
- All users can see books synced from the cloud in real-time
- December 17, 2025: Bandwidth optimization
- Separated book metadata from file content to reduce downloads
- Files now loaded on-demand instead of all at once
- Added local file caching to prevent re-downloads
- Added migration tool in Admin panel for existing books
- December 18, 2025: Implemented comprehensive local caching system
- Added IndexedDB storage for book files (PDFs, EPUBs)
- Added localStorage caching for book metadata
- App now loads cached data instantly on init
- Firebase downloads only occur for new/updated content
- Offline mode support when Firebase is unavailable
- Cache cleanup on book deletion
- **Bug Fix**: Fixed bottom navigation disappearing when returning to home after reading
  - Issue: Wrong CSS class used when opening reader (`hidden` vs `nav-hidden`)
  - Fixed in `openBook()` function - now uses correct `nav-hidden` class
  - Navigation state now properly maintained through all view transitions
- **Reading Progress Tracking**: Implemented continue reading section improvements
  - Now shows only books the user has actually started reading (pages > 0)
  - Displays accurate page numbers: "Page X of Y" instead of fake chapter numbers
  - Reads are sorted by most recently read
  - Progress percentage calculated from actual pages read vs total pages
  - Reading progress automatically saved when closing reader via `setReadingProgress()`
  - LocalStorage key: `shelf_reading_progress` stores per-book progress data
- **Hide from Continue Reading**: Added context menu for continue reading books
  - Click 3-dot menu button on continue reading card to open context menu
  - Select "Hide from Continue Reading" option
  - Book is hidden immediately and toast notification confirms action
  - Hidden status persists in localStorage under `shelf_hidden_books`
  - Book automatically unhides when user opens and reads it again
  - Menu closes when clicking outside or selecting an option
- **Empty State Message for Continue Reading**: Always show the section with helpful message
  - Continue Reading section always displays (never hidden)
  - When no books started: Shows "Start Reading" message with emoji and encouragement text
  - Message: "You haven't started reading any books yet. Pick a book and start your reading journey!"
  - Styled consistently with rest of app with centered layout
- **Auto-Update Continue Reading**: Section updates automatically without page reload
  - `renderHome()` called when returning from reader to home view
  - `renderLibrary()` called when returning to library view
  - `renderAdminBooks()` called when returning to admin view
  - `goBack()` function now re-renders content for each view
  - Continue reading section shows newly started books immediately upon return
- **Desktop Access Control**: New admin setting to restrict app to mobile devices
  - Toggle option in Admin > User Control tab: "Allow Desktop Access"
  - When enabled (default): App works on all devices
  - When disabled: Desktop browsers see minimal "Mobile Only" message with icon and instructions
  - Mobile detection uses user agent + screen width analysis for accurate device classification
  - Setting stored in Firebase RTDB at `settings/allowDesktops`
  - Desktop block view is clean, minimal, and user-friendly
  - Only admins can toggle this setting
  - Setting fetched from RTDB on app initialization
  - Uses cached state (`desktopAccessAllowed`) for performance
- **Resume Reading from Last Page**: Books now open at the page user was on
  - When opening a book from continue reading or elsewhere, app checks saved progress
  - Restores to last page if it exists and is valid (within total pages)
  - Falls back to page 1 if no progress saved
  - Page restoration happens before PDF rendering for smooth loading
  - Progress verified: ensures page number doesn't exceed total pages
  - **Instant Continue Reading Display**: Reading progress saved immediately when page renders
    - No page reload needed to see books in continue reading section
    - Progress auto-saves on first page load and every page navigation
    - Books appear in continue reading instantly when user opens a book
- **Desktop Access Block Message**: When desktop access is disabled from admin panel
  - Shows clear "Mobile Only" message with icon and instructions instead of blank screen
  - Message displays: "This app is optimized for mobile devices"
  - Hides header and navigation to focus on the message
  - Improved user experience when accessing from desktop when not allowed
