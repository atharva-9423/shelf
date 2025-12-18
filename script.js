let books = [];
let lastReadBook = null;
let firebaseReady = false;
let isLoading = true;
let desktopAccessAllowed = true;
let currentUserData = null;
let userApprovalListener = null;
const fileCache = new Map();

const CACHE_KEYS = {
  BOOKS_META: 'shelf_books_cache',
  CACHE_VERSION: 'shelf_cache_version',
  LAST_SYNC: 'shelf_last_sync',
  READING_PROGRESS: 'shelf_reading_progress',
  HIDDEN_BOOKS: 'shelf_hidden_books',
  ALLOW_DESKTOPS: 'shelf_allow_desktops',
  BOOKMARKS: 'shelf_bookmarks',
  USER_ID: 'shelf_user_id',
  USER_STATUS: 'shelf_user_status'
};

function getUserId() {
  let userId = localStorage.getItem(CACHE_KEYS.USER_ID);
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(CACHE_KEYS.USER_ID, userId);
  }
  return userId;
}

function getUserStatus() {
  return localStorage.getItem(CACHE_KEYS.USER_STATUS) || 'none';
}

function setUserStatus(status) {
  localStorage.setItem(CACHE_KEYS.USER_STATUS, status);
}

async function checkUserApprovalStatus() {
  const userId = getUserId();
  const userRef = window.firebaseRef(window.firebaseDB, `pending-users/${userId}`);
  
  try {
    const snapshot = await window.firebaseGet(userRef);
    if (snapshot.exists()) {
      const userData = snapshot.val();
      currentUserData = userData;
      
      if (userData.status === 'approved') {
        setUserStatus('approved');
        return 'approved';
      } else if (userData.status === 'rejected') {
        setUserStatus('rejected');
        return 'rejected';
      } else {
        setUserStatus('pending');
        return 'pending';
      }
    }
    
    const approvedRef = window.firebaseRef(window.firebaseDB, `approved-users/${userId}`);
    const approvedSnapshot = await window.firebaseGet(approvedRef);
    if (approvedSnapshot.exists()) {
      setUserStatus('approved');
      return 'approved';
    }
    
    return 'none';
  } catch (error) {
    console.error('Error checking user status:', error);
    return getUserStatus();
  }
}

function listenForApproval() {
  const userId = getUserId();
  const userRef = window.firebaseRef(window.firebaseDB, `pending-users/${userId}`);
  
  if (userApprovalListener) return;
  
  userApprovalListener = window.firebaseOnValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
      const userData = snapshot.val();
      
      if (userData.status === 'approved') {
        setUserStatus('approved');
        showToast('Registration approved! Welcome to Shelf!');
        showMainApp();
      } else if (userData.status === 'rejected') {
        setUserStatus('rejected');
        showRejectedMessage();
      }
    }
  });
}

function showRejectedMessage() {
  const pendingMessage = document.getElementById('auth-pending-message');
  if (pendingMessage) {
    pendingMessage.innerHTML = `
      <div class="pending-icon" style="background: #fee2e2;">
        <i class="fa-solid fa-xmark" style="color: #dc2626;"></i>
      </div>
      <h3 style="color: #dc2626;">Registration Rejected</h3>
      <p style="color: #991b1b;">Your registration was not approved. Please contact the administrator.</p>
    `;
    pendingMessage.style.background = '#fef2f2';
    pendingMessage.style.borderColor = '#fecaca';
    pendingMessage.classList.remove('hidden');
  }
}

async function handleUserRegistration(e) {
  e.preventDefault();
  
  const name = document.getElementById('user-name').value.trim();
  const div = document.getElementById('user-div').value.trim();
  const branch = document.getElementById('user-branch').value;
  const year = document.getElementById('user-year').value;
  const idCardInput = document.getElementById('user-idcard');
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');
  
  if (!name || !div || !branch || !year || !idCardInput.files[0]) {
    errorEl.textContent = 'Please fill in all fields and upload your ID card';
    return;
  }
  
  const idCardFile = idCardInput.files[0];
  if (idCardFile.size > 5 * 1024 * 1024) {
    errorEl.textContent = 'ID card image must be less than 5MB';
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Submitting...</span>';
  errorEl.textContent = '';
  
  try {
    const idCardData = await readFileAsDataURL(idCardFile);
    
    const userId = getUserId();
    const userRef = window.firebaseRef(window.firebaseDB, `pending-users/${userId}`);
    
    await window.firebaseSet(userRef, {
      name,
      division: div,
      branch,
      year,
      idCard: idCardData,
      status: 'pending',
      submittedAt: new Date().toISOString()
    });
    
    setUserStatus('pending');
    showPendingScreen();
    listenForApproval();
    showToast('Registration submitted successfully!');
    
  } catch (error) {
    console.error('Registration error:', error);
    errorEl.textContent = 'Failed to submit registration. Please try again.';
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Submit Registration</span>';
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function showPendingScreen() {
  const form = document.getElementById('auth-register-form');
  const pendingMessage = document.getElementById('auth-pending-message');
  
  if (form) form.classList.add('hidden');
  if (pendingMessage) pendingMessage.classList.remove('hidden');
}

function showMainApp() {
  const authGate = document.getElementById('auth-gate-view');
  const homeView = document.getElementById('home-view');
  const globalHeader = document.getElementById('global-header');
  const bottomNav = document.getElementById('bottom-nav');
  
  if (authGate) authGate.classList.remove('active');
  if (homeView) homeView.classList.add('active');
  if (globalHeader) globalHeader.classList.remove('hidden');
  if (bottomNav) bottomNav.classList.remove('hidden');
  
  renderHome();
  renderLibrary();
}

const DB_NAME = 'ShelfBooksDB';
const DB_VERSION = 1;
const STORE_NAME = 'bookFiles';

let indexedDB_instance = null;

function getReadingProgress() {
  try {
    const progress = localStorage.getItem(CACHE_KEYS.READING_PROGRESS);
    return progress ? JSON.parse(progress) : {};
  } catch {
    return {};
  }
}

function setReadingProgress(bookId, currentPage, totalPages) {
  try {
    const progress = getReadingProgress();
    progress[bookId] = { currentPage, totalPages, lastRead: new Date().toISOString() };
    localStorage.setItem(CACHE_KEYS.READING_PROGRESS, JSON.stringify(progress));
    
    // Immediately update the continue reading section if we're on home view
    const activeView = document.querySelector('.view.active');
    if (activeView && activeView.id === 'home-view') {
      renderHome();
    }
  } catch (error) {
    console.error('Error saving reading progress:', error);
  }
}

function getStartedBooks() {
  const progress = getReadingProgress();
  const hiddenBooks = getHiddenBooks();
  return books.filter(book => progress[book.id] && progress[book.id].currentPage > 0 && !hiddenBooks[book.id])
    .sort((a, b) => {
      const aTime = new Date(progress[a.id].lastRead);
      const bTime = new Date(progress[b.id].lastRead);
      return bTime - aTime;
    });
}

function getHiddenBooks() {
  try {
    const hidden = localStorage.getItem(CACHE_KEYS.HIDDEN_BOOKS);
    return hidden ? JSON.parse(hidden) : {};
  } catch {
    return {};
  }
}

function hideBook(bookId) {
  try {
    const hidden = getHiddenBooks();
    hidden[bookId] = Date.now();
    localStorage.setItem(CACHE_KEYS.HIDDEN_BOOKS, JSON.stringify(hidden));
  } catch (error) {
    console.error('Error hiding book:', error);
  }
}

function unhideBook(bookId) {
  try {
    const hidden = getHiddenBooks();
    delete hidden[bookId];
    localStorage.setItem(CACHE_KEYS.HIDDEN_BOOKS, JSON.stringify(hidden));
  } catch (error) {
    console.error('Error unhiding book:', error);
  }
}

function isDesktop() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTablet = /ipad|android|tablet/i.test(userAgent);
  const screenWidth = window.innerWidth;
  
  // Consider desktop if: not mobile OS AND (not tablet OR screen width > 768px on tablet OS)
  return !isMobile || (isTablet && screenWidth > 768);
}

function isDesktopAccessAllowed() {
  return desktopAccessAllowed;
}

async function fetchDesktopAccessFromDB() {
  try {
    const settingsRef = window.firebaseRef(window.firebaseDB, 'settings/allowDesktops');
    const snapshot = await window.firebaseGet(settingsRef);
    desktopAccessAllowed = snapshot.exists() ? snapshot.val() : true;
    console.log('Desktop access setting fetched:', desktopAccessAllowed);
    return desktopAccessAllowed;
  } catch (error) {
    console.error('Error fetching desktop access setting:', error);
    desktopAccessAllowed = true;
    return true;
  }
}

async function setDesktopAccess(allowed) {
  try {
    const settingsRef = window.firebaseRef(window.firebaseDB, 'settings/allowDesktops');
    await window.firebaseSet(settingsRef, allowed);
    desktopAccessAllowed = allowed;
    console.log('Desktop access setting updated in RTDB:', allowed);
  } catch (error) {
    console.error('Error setting desktop access in RTDB:', error);
  }
}

async function toggleDesktopAccess() {
  const toggle = document.getElementById('allow-desktops-toggle');
  const allowed = toggle.checked;
  await setDesktopAccess(allowed);
  showToast(allowed ? 'Desktop access enabled' : 'Desktop access disabled');
}

function checkDesktopAccess() {
  if (isDesktop() && !isDesktopAccessAllowed()) {
    // Hide header and bottom navigation
    const header = document.getElementById('global-header');
    const bottomNav = document.getElementById('bottom-nav');
    const bottomReadBtn = document.getElementById('bottom-read-btn');
    if (header) header.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';
    if (bottomReadBtn) bottomReadBtn.style.display = 'none';
    
    // Hide all regular views and show only the desktop block view
    const views = document.querySelectorAll('.view:not(#desktop-block-view)');
    views.forEach(view => view.style.display = 'none');
    
    const desktopBlockView = document.getElementById('desktop-block-view');
    if (desktopBlockView) {
      desktopBlockView.classList.add('active');
      desktopBlockView.style.display = 'flex';
      desktopBlockView.style.flexDirection = 'column';
      desktopBlockView.style.justifyContent = 'center';
      desktopBlockView.style.alignItems = 'center';
      desktopBlockView.style.minHeight = '100vh';
    }
  }
}

function openBooksDatabase() {
  return new Promise((resolve, reject) => {
    if (indexedDB_instance) {
      resolve(indexedDB_instance);
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      indexedDB_instance = request.result;
      resolve(indexedDB_instance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
      }
    };
  });
}

async function getBookFileFromCache(bookId) {
  try {
    const db = await openBooksDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.fileData : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB read error:', error);
    return null;
  }
}

async function saveBookFileToCache(bookId, fileData) {
  try {
    const db = await openBooksDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ bookId, fileData, cachedAt: Date.now() });
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB write error:', error);
    return false;
  }
}

async function deleteBookFileFromCache(bookId) {
  try {
    const db = await openBooksDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(bookId);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB delete error:', error);
    return false;
  }
}

function getCachedBooksMeta() {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.BOOKS_META);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function saveBooksMetaToCache(booksData) {
  try {
    localStorage.setItem(CACHE_KEYS.BOOKS_META, JSON.stringify(booksData));
    localStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    console.error('localStorage write error:', error);
  }
}

function removeCachedBookMeta(bookId) {
  try {
    const cached = getCachedBooksMeta();
    if (cached && cached[bookId]) {
      delete cached[bookId];
      localStorage.setItem(CACHE_KEYS.BOOKS_META, JSON.stringify(cached));
    }
  } catch (error) {
    console.error('Cache removal error:', error);
  }
}

let isSyncing = false;
let syncQueue = [];
let syncProgress = { total: 0, completed: 0 };

async function syncAllBooksToCache(bookIds) {
  if (isSyncing) {
    syncQueue = [...new Set([...syncQueue, ...bookIds])];
    return;
  }
  
  const uncachedBooks = [];
  for (const bookId of bookIds) {
    const cached = await getBookFileFromCache(bookId);
    if (!cached) {
      uncachedBooks.push(bookId);
    }
  }
  
  if (uncachedBooks.length === 0) {
    console.log('All books already cached locally');
    return;
  }
  
  isSyncing = true;
  syncProgress = { total: uncachedBooks.length, completed: 0 };
  
  console.log(`Starting background sync: ${uncachedBooks.length} books to download`);
  showToast(`Caching ${uncachedBooks.length} book(s) for offline use...`);
  
  for (const bookId of uncachedBooks) {
    try {
      const fileRef = window.firebaseRef(window.firebaseDB, `book-files/${bookId}`);
      const snapshot = await window.firebaseGet(fileRef);
      
      if (snapshot.exists()) {
        const fileData = snapshot.val();
        await saveBookFileToCache(bookId, fileData);
        fileCache.set(bookId, fileData);
        syncProgress.completed++;
        console.log(`Cached book ${bookId} (${syncProgress.completed}/${syncProgress.total})`);
      }
    } catch (error) {
      console.error(`Failed to cache book ${bookId}:`, error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  isSyncing = false;
  console.log('Background sync complete');
  showToast('All books cached for offline reading!');
  
  if (syncQueue.length > 0) {
    const nextBatch = [...syncQueue];
    syncQueue = [];
    syncAllBooksToCache(nextBatch);
  }
}

async function syncNewBooks(currentBookIds, previousBookIds) {
  const newBookIds = currentBookIds.filter(id => !previousBookIds.includes(id));
  
  if (newBookIds.length > 0) {
    console.log(`New books detected: ${newBookIds.length}`);
    showToast(`New book uploaded! Downloading...`);
    await syncAllBooksToCache(newBookIds);
  }
}

function waitForFirebase() {
  return new Promise((resolve) => {
    const checkFirebase = () => {
      if (window.firebaseDB && window.firebaseRef && window.firebaseOnValue && window.firebaseGet) {
        resolve();
      } else {
        setTimeout(checkFirebase, 100);
      }
    };
    checkFirebase();
  });
}

function updateGreeting() {
  const hour = new Date().getHours();
  let greeting;
  
  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good evening';
  } else {
    greeting = 'Good night';
  }
  
  const greetingEl = document.getElementById('greeting-text');
  if (greetingEl) {
    greetingEl.textContent = greeting;
  }
}

async function init() {
  try {
    // Check if admin should be opened via URL - redirect to admin.html
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const pathHasAdmin = window.location.pathname.includes('/admin');
    
    if (urlParams.has('admin') || hashParams.has('admin') || pathHasAdmin || window.location.search.includes('admin') || window.location.hash.includes('admin')) {
      window.location.href = '/admin.html';
      return;
    }
    
    await waitForFirebase();
    firebaseReady = true;
    
    // Fetch desktop access setting from RTDB first
    await fetchDesktopAccessFromDB();
    checkDesktopAccess();
    
    // Check user authentication status
    const userStatus = await checkUserApprovalStatus();
    
    if (userStatus === 'approved') {
      showMainApp();
    } else if (userStatus === 'pending') {
      showPendingScreen();
      listenForApproval();
      return;
    } else if (userStatus === 'rejected') {
      showRejectedMessage();
      return;
    } else {
      return;
    }
    
    isLoading = true;
    showSkeletons();
    updateGreeting();
    
    initHistoryState();
    
    await openBooksDatabase();
    
    lastReadBook = localStorage.getItem('shelf_last_read');
    
    const cachedMeta = getCachedBooksMeta();
    if (cachedMeta) {
      books = Object.entries(cachedMeta).map(([id, book]) => ({
        ...book,
        id: id,
        isNewFormat: true
      }));
      books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      isLoading = false;
      renderHome();
      renderLibrary();
      console.log('Loaded books from local cache');
    }
    
    setupFirebaseListener();
    
    // Auto-refresh home and library views to ensure continue reading section updates immediately
    setInterval(() => {
      const activeView = document.querySelector('.view.active');
      if (activeView) {
        if (activeView.id === 'home-view') {
          renderHome();
        } else if (activeView.id === 'library-view') {
          renderLibrary();
        }
      }
    }, 2000);
    
  } catch (error) {
    console.error('Failed to initialize:', error);
    showToast('Connection error. Please refresh.');
    isLoading = false;
  }
}

function showSkeletons() {
  const carousel = document.getElementById('books-carousel');
  const grid = document.getElementById('library-grid');
  const continueSection = document.getElementById('continue-reading-section');
  const continueCard = document.getElementById('continue-reading-card');
  
  if (carousel) {
    carousel.innerHTML = Array(4).fill('').map(() => `
      <div class="carousel-book skeleton-book">
        <div class="carousel-book-cover skeleton"></div>
        <div class="skeleton skeleton-text" style="width: 60%; height: 14px; margin-top: 8px;"></div>
      </div>
    `).join('');
  }
  
  if (grid) {
    grid.innerHTML = Array(6).fill('').map(() => `
      <div class="library-book skeleton-book">
        <div class="library-book-cover skeleton"></div>
        <div class="skeleton skeleton-text" style="width: 80%; height: 14px; margin-top: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 50%; height: 12px; margin-top: 4px;"></div>
      </div>
    `).join('');
  }
  
  if (continueSection && continueCard) {
    continueSection.classList.remove('hidden');
    continueCard.innerHTML = `
      <div class="continue-book-cover skeleton"></div>
      <div class="continue-book-info">
        <div class="skeleton skeleton-text" style="width: 70%; height: 18px;"></div>
        <div class="skeleton skeleton-text" style="width: 50%; height: 14px; margin-top: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 40%; height: 12px; margin-top: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 100%; height: 8px; margin-top: 12px; border-radius: 4px;"></div>
        <div class="skeleton skeleton-text" style="width: 80px; height: 32px; margin-top: 12px; border-radius: 20px;"></div>
      </div>
    `;
  }
}

let previousBookIds = [];

function setupFirebaseListener() {
  const metaRef = window.firebaseRef(window.firebaseDB, 'book-meta');
  
  window.firebaseOnValue(metaRef, async (snapshot) => {
    const data = snapshot.val();
    
    if (data) {
      const cachedMeta = getCachedBooksMeta();
      const currentBookIds = Object.keys(data);
      const cachedBookIds = cachedMeta ? Object.keys(cachedMeta) : [];
      
      const hasChanges = !cachedMeta || JSON.stringify(data) !== JSON.stringify(cachedMeta);
      
      if (hasChanges) {
        saveBooksMetaToCache(data);
        console.log('Updated local cache with new data from Firebase');
        
        if (cachedMeta) {
          syncNewBooks(currentBookIds, cachedBookIds);
        }
      } else {
        console.log('No changes detected, using cached data');
      }
      
      books = Object.entries(data).map(([id, book]) => ({
        ...book,
        id: id,
        isNewFormat: true
      }));
      books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      if (previousBookIds.length === 0) {
        previousBookIds = currentBookIds;
        syncAllBooksToCache(currentBookIds);
      } else {
        previousBookIds = currentBookIds;
      }
    } else {
      books = [];
      localStorage.removeItem(CACHE_KEYS.BOOKS_META);
    }
    
    isLoading = false;
    renderHome();
    renderLibrary();
  }, (error) => {
    console.error('Firebase read error:', error);
    const cachedMeta = getCachedBooksMeta();
    if (cachedMeta && books.length === 0) {
      books = Object.entries(cachedMeta).map(([id, book]) => ({
        ...book,
        id: id,
        isNewFormat: true
      }));
      books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      showToast('Offline mode - using cached books');
    } else {
      showToast('Failed to load books');
    }
    isLoading = false;
    renderHome();
    renderLibrary();
  });
}

async function getBookFileData(bookId) {
  if (fileCache.has(bookId)) {
    console.log('Book file loaded from memory cache');
    return fileCache.get(bookId);
  }
  
  const cachedFile = await getBookFileFromCache(bookId);
  if (cachedFile) {
    console.log('Book file loaded from IndexedDB cache');
    fileCache.set(bookId, cachedFile);
    return cachedFile;
  }
  
  try {
    const fileRef = window.firebaseRef(window.firebaseDB, `book-files/${bookId}`);
    const snapshot = await window.firebaseGet(fileRef);
    
    if (snapshot.exists()) {
      const fileData = snapshot.val();
      fileCache.set(bookId, fileData);
      await saveBookFileToCache(bookId, fileData);
      console.log('Book file downloaded from Firebase and cached locally');
      return fileData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching file data:', error);
    return null;
  }
}


function updateHeaderLogo(logoType = 'app') {
  const appLogo = document.getElementById('header-logo-app');
  const bookmarksLogo = document.getElementById('header-logo-bookmarks');
  const libraryLogo = document.getElementById('header-logo-library');
  
  appLogo.classList.add('hidden');
  bookmarksLogo.classList.add('hidden');
  libraryLogo.classList.add('hidden');
  
  if (logoType === 'bookmarks') {
    bookmarksLogo.classList.remove('hidden');
  } else if (logoType === 'library') {
    libraryLogo.classList.remove('hidden');
  } else {
    appLogo.classList.remove('hidden');
  }
}

function showHome() {
  setActiveView('home-view');
  setActiveNav('nav-home');
  updateHeaderLogo('app');
  renderHome();
}

function showLibrary() {
  setActiveView('library-view');
  setActiveNav('nav-library');
  updateHeaderLogo('library');
  renderLibrary();
}

function showBookmarks() {
  setActiveView('bookmarks-view');
  setActiveNav('nav-bookmark');
  updateHeaderLogo('bookmarks');
  renderBookmarks();
}

function renderBookmarks() {
  const grid = document.getElementById('bookmarks-grid');
  const empty = document.getElementById('bookmarks-empty');
  
  const bookmarks = getBookmarkedBooks();
  const bookmarkedIds = Object.keys(bookmarks);
  const bookmarkedBooks = books.filter(book => bookmarkedIds.includes(book.id));
  
  if (bookmarkedBooks.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  
  grid.innerHTML = bookmarkedBooks.map(book => `
    <div class="library-book" onclick="openBookDetail('${book.id}')">
      <div class="library-book-cover">
        ${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}">` : '📖'}
      </div>
      <div class="library-book-title">${escapeHtml(book.title)}</div>
      <div class="library-book-author">${escapeHtml(book.author)}</div>
    </div>
  `).join('');
}

let currentView = 'home-view';
let viewHistory = ['home-view'];
let isTransitioning = false;
let isHandlingPopstate = false;

function initHistoryState() {
  history.replaceState({ view: 'home-view', index: 0 }, '', '');
}

function pushHistoryState(viewId) {
  history.pushState({ view: viewId, index: viewHistory.length }, '', '');
}

window.addEventListener('popstate', (event) => {
  if (isTransitioning || isHandlingPopstate) return;
  
  isHandlingPopstate = true;
  
  if (currentView === 'reader-view') {
    closeReader();
  } else if (currentView === 'book-detail-view') {
    closeBookDetail();
  } else if (viewHistory.length > 1) {
    const previousView = viewHistory[viewHistory.length - 2];
    setActiveView(previousView, 'back');
    
    if (previousView === 'home-view') {
      setActiveNav('nav-home');
    } else if (previousView === 'library-view') {
      setActiveNav('nav-library');
    } else if (previousView === 'bookmarks-view') {
      setActiveNav('nav-bookmark');
    } else if (previousView === 'admin-view') {
      setActiveNav('nav-admin');
    }
  }
  
  setTimeout(() => {
    isHandlingPopstate = false;
  }, 350);
});

function setActiveView(viewId, direction = 'forward') {
  if (currentView === viewId) return;
  
  const currentViewEl = document.getElementById(currentView);
  const newViewEl = document.getElementById(viewId);
  
  if (!currentViewEl || !newViewEl) return;
  
  // Handle global header visibility
  const globalHeader = document.getElementById('global-header');
  if (viewId === 'home-view' || viewId === 'book-detail-view' || viewId === 'library-view' || viewId === 'bookmarks-view') {
    globalHeader.classList.remove('hidden');
  } else {
    globalHeader.classList.add('hidden');
  }
  
  // Clear any existing animation classes
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  });
  
  // Update current view immediately for responsive UI
  currentView = viewId;
  newViewEl.classList.add('active');
  
  if (direction === 'forward') {
    // New page slides in from right, current slides out to left
    currentViewEl.classList.add('slide-out-left');
    newViewEl.classList.add('slide-in-right');
    viewHistory.push(viewId);
    if (!isHandlingPopstate) {
      pushHistoryState(viewId);
    }
  } else {
    // Going back: current slides out to right, previous slides in from left
    currentViewEl.classList.add('slide-out-right');
    newViewEl.classList.add('slide-in-left');
    viewHistory.pop();
  }
  
  // Clean up animations after transition completes
  setTimeout(() => {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
      if (v.id !== currentView) {
        v.classList.remove('active');
      }
    });
  }, 250);
}

function setActiveNav(navId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.getElementById(navId);
  if (activeNav) {
    activeNav.classList.add('active');
    // Use requestAnimationFrame to avoid layout thrashing
    requestAnimationFrame(() => updateNavIndicator(activeNav));
  }
}

function updateNavIndicator(activeElement) {
  const indicator = document.getElementById('nav-indicator');
  const nav = document.getElementById('bottom-nav');
  if (indicator && activeElement && nav) {
    const navRect = nav.getBoundingClientRect();
    const activeRect = activeElement.getBoundingClientRect();
    const centerPos = activeRect.left - navRect.left + activeRect.width / 2;
    indicator.style.left = centerPos + 'px';
  }
}

function initNavIndicator() {
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) {
    updateNavIndicator(activeNav);
  }
}

window.addEventListener('load', initNavIndicator);
window.addEventListener('resize', initNavIndicator);

function renderHome() {
  const carousel = document.getElementById('books-carousel');
  const empty = document.getElementById('home-empty');
  const continueSection = document.getElementById('continue-reading-section');
  const continueCard = document.getElementById('continue-reading-card');
  
  if (books.length === 0) {
    carousel.innerHTML = '';
    empty.classList.remove('hidden');
    continueSection.classList.add('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  
  carousel.innerHTML = books.map(book => `
    <div class="carousel-book" onclick="openBookDetail('${book.id}')">
      <div class="carousel-book-cover">
        ${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}">` : '📚'}
      </div>
      <div class="carousel-book-author">${escapeHtml(book.author)}</div>
    </div>
  `).join('');
  
  // Always show the continue reading section
  continueSection.classList.remove('hidden');
  
  const startedBooks = getStartedBooks();
  if (startedBooks.length > 0) {
    const progress = getReadingProgress();
    const continueBook = startedBooks[0];
    const bookProgress = progress[continueBook.id];
    const progressPercent = Math.round((bookProgress.currentPage / bookProgress.totalPages) * 100);
    
    continueCard.innerHTML = `
      <div class="continue-book-cover" onclick="openBook('${continueBook.id}')">
        ${continueBook.cover ? `<img src="${continueBook.cover}" alt="${escapeHtml(continueBook.title)}">` : '📖'}
      </div>
      <div class="continue-book-info">
        <div class="continue-book-title">${escapeHtml(continueBook.title)}</div>
        <div class="continue-book-chapter">Page ${bookProgress.currentPage} of ${bookProgress.totalPages}</div>
        <div class="continue-book-rating">
          <span class="star">★</span>
          <span class="star">★</span>
          <span class="star">★</span>
          <span class="star">★</span>
          <span class="star empty">★</span>
        </div>
        <div class="progress-row">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <span class="progress-text">${progressPercent}%</span>
        </div>
        <button class="play-btn" onclick="openBook('${continueBook.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Play
        </button>
      </div>
      <button class="continue-more-btn" onclick="openContinueMenu('${continueBook.id}', event)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </button>
    `;
  } else {
    continueCard.innerHTML = `
      <div class="continue-empty">
        <div class="continue-empty-icon">📖</div>
        <p class="continue-empty-title">Start Reading</p>
        <p class="continue-empty-text">You haven't started reading any books yet. Pick a book and start your reading journey!</p>
      </div>
    `;
  }
}

function renderLibrary() {
  const grid = document.getElementById('library-grid');
  const empty = document.getElementById('library-empty');
  
  if (books.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  
  grid.innerHTML = books.map(book => `
    <div class="library-book" onclick="openBookDetail('${book.id}')">
      <div class="library-book-cover">
        ${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}">` : '📖'}
      </div>
      <div class="library-book-title">${escapeHtml(book.title)}</div>
      <div class="library-book-author">${escapeHtml(book.author)}</div>
    </div>
  `).join('');
}

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let pdfRenderTask = null;
let pdfZoom = 1;
let pdfBaseScale = 1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

// Pinch-to-zoom variables
let initialPinchDistance = 0;
let initialPinchZoom = 1;
let isPinching = false;
let currentPinchScale = 1;

// Book detail page variables
let currentDetailBookId = null;
let detailCarouselIndex = 0;
let continueBookMenuId = null;

function openBookDetail(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  
  currentDetailBookId = id;
  detailCarouselIndex = books.findIndex(b => b.id === id);
  
  // Transition bottom nav to read button
  document.getElementById('bottom-nav').classList.add('nav-hidden');
  setTimeout(() => {
    document.getElementById('bottom-read-btn').classList.add('active');
  }, 150);
  
  // Show back button in header
  document.getElementById('global-header').classList.add('show-back');
  
  setActiveView('book-detail-view');
  renderDetailCarousel();
  updateDetailInfo();
}

function renderDetailCarousel() {
  const carousel = document.getElementById('detail-books-carousel');
  
  const visibleBooks = getVisibleBooksForCarousel();
  
  carousel.innerHTML = visibleBooks.map((book, idx) => {
    const isActive = book.id === currentDetailBookId;
    return `
      <div class="detail-book-card ${isActive ? 'active' : ''}" onclick="selectDetailBook('${book.id}')">
        ${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}">` : `<div class="placeholder">📚</div>`}
      </div>
    `;
  }).join('');
}

function getVisibleBooksForCarousel() {
  if (books.length <= 3) return books;
  
  const currentIdx = books.findIndex(b => b.id === currentDetailBookId);
  let prevIdx = currentIdx - 1;
  let nextIdx = currentIdx + 1;
  
  if (prevIdx < 0) prevIdx = books.length - 1;
  if (nextIdx >= books.length) nextIdx = 0;
  
  return [books[prevIdx], books[currentIdx], books[nextIdx]];
}

function selectDetailBook(id) {
  currentDetailBookId = id;
  detailCarouselIndex = books.findIndex(b => b.id === id);
  renderDetailCarousel();
  updateDetailInfo();
}

function getBookmarkedBooks() {
  try {
    const bookmarks = localStorage.getItem(CACHE_KEYS.BOOKMARKS);
    return bookmarks ? JSON.parse(bookmarks) : {};
  } catch {
    return {};
  }
}

function toggleBookmark(bookId) {
  try {
    // Use provided bookId or fall back to currentDetailBookId
    const id = bookId || currentDetailBookId;
    if (!id) {
      console.error('No book ID available for bookmarking');
      return;
    }
    
    const bookmarks = getBookmarkedBooks();
    if (bookmarks[id]) {
      delete bookmarks[id];
      showToast('Removed from bookmarks');
    } else {
      bookmarks[id] = Date.now();
      showToast('Added to bookmarks');
    }
    localStorage.setItem(CACHE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    updateDetailInfo();
  } catch (error) {
    console.error('Error toggling bookmark:', error);
  }
}

function updateDetailInfo() {
  const book = books.find(b => b.id === currentDetailBookId);
  if (!book) return;
  
  document.getElementById('detail-author').textContent = book.author.toUpperCase();
  document.getElementById('detail-description').textContent = book.description || 'No description available for this book.';
  
  const pages = book.pages || '--';
  document.getElementById('detail-pages').textContent = pages;
  
  // Update bookmark button
  const bookmarks = getBookmarkedBooks();
  const bookmarkBtn = document.getElementById('detail-bookmark-btn');
  if (bookmarkBtn) {
    if (bookmarks[currentDetailBookId]) {
      bookmarkBtn.classList.add('bookmarked');
      bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
    } else {
      bookmarkBtn.classList.remove('bookmarked');
      bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
    }
  }
}

function closeBookDetail() {
  // Transition read button back to bottom nav
  document.getElementById('bottom-read-btn').classList.remove('active');
  setTimeout(() => {
    document.getElementById('bottom-nav').classList.remove('nav-hidden');
    // Recalculate nav indicator position after nav transition completes
    setTimeout(() => {
      setActiveNav('nav-home');
      initNavIndicator();
      // Refresh home view immediately to show updated continue reading section
      renderHome();
    }, 300);
  }, 150);
  
  // Hide back button in header
  document.getElementById('global-header').classList.remove('show-back');
  
  setActiveView('home-view', 'back');
}

function startReading() {
  if (currentDetailBookId) {
    // Hide the read button when entering reader
    document.getElementById('bottom-read-btn').classList.remove('active');
    openBook(currentDetailBookId);
  }
}

async function openBook(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  
  localStorage.setItem('shelf_last_read', id);
  lastReadBook = id;
  
  // Unhide the book when opening it
  unhideBook(id);
  
  document.getElementById('bottom-nav').classList.add('nav-hidden');
  
  setActiveView('reader-view');
  document.getElementById('reader-title').textContent = book.title;
  
  const iframe = document.getElementById('book-iframe');
  const pdfViewer = document.getElementById('pdf-viewer');
  const pdfControls = document.getElementById('pdf-controls');
  
  showToast('Loading book...');
  
  const fileData = await getBookFileData(id);
  
  if (!fileData) {
    showToast('Failed to load book file');
    return;
  }
  
  if (book.fileName.endsWith('.pdf')) {
    iframe.classList.add('hidden');
    pdfViewer.classList.add('active');
    pdfControls.classList.add('active');
    document.getElementById('pdf-reset-btn').classList.add('active');
    renderPdf(fileData, id);
  } else {
    iframe.classList.remove('hidden');
    pdfViewer.classList.remove('active');
    pdfControls.classList.remove('active');
    document.getElementById('pdf-reset-btn').classList.remove('active');
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui, sans-serif; padding: 48px 24px; max-width: 640px; margin: 0 auto; color: #1a1a1a; }
            a { color: #1a1a1a; }
          </style>
        </head>
        <body>
          <p style="color: #666;">EPUB files require additional processing. The file has been stored successfully.</p>
          <p><a href="${fileData}" download="${escapeHtml(book.fileName)}">Download ${escapeHtml(book.fileName)}</a></p>
        </body>
      </html>
    `;
  }
}

async function renderPdf(dataUrl, bookId) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    totalPages = pdfDoc.numPages;
    
    // Restore last read page if available
    const progress = getReadingProgress();
    if (progress[bookId] && progress[bookId].currentPage > 0) {
      currentPage = Math.min(progress[bookId].currentPage, totalPages);
      console.log(`Resuming book from page ${currentPage}`);
    } else {
      currentPage = 1;
    }
    
    renderPage(currentPage);
    setupPinchZoom();
  } catch (error) {
    console.error('Error loading PDF:', error);
    showToast('Failed to load PDF');
  }
}

function setupPinchZoom() {
  const pdfViewer = document.getElementById('pdf-viewer');
  
  pdfViewer.addEventListener('touchstart', handleTouchStart, { passive: false });
  pdfViewer.addEventListener('touchmove', handleTouchMove, { passive: false });
  pdfViewer.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function getDistance(touch1, touch2) {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

let canvasBaseWidth = 0;
let canvasBaseHeight = 0;
let initialScrollLeft = 0;
let initialScrollTop = 0;
let pinchCenterX = 0;
let pinchCenterY = 0;

function getPinchCenter(touch1, touch2) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2
  };
}

function handleTouchStart(e) {
  if (e.touches.length === 2) {
    e.preventDefault();
    isPinching = true;
    initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
    initialPinchZoom = pdfZoom;
    
    const canvas = document.getElementById('pdf-canvas');
    const pdfViewer = document.getElementById('pdf-viewer');
    canvasBaseWidth = parseFloat(canvas.style.width);
    canvasBaseHeight = parseFloat(canvas.style.height);
    
    initialScrollLeft = pdfViewer.scrollLeft;
    initialScrollTop = pdfViewer.scrollTop;
    
    const center = getPinchCenter(e.touches[0], e.touches[1]);
    const viewerRect = pdfViewer.getBoundingClientRect();
    pinchCenterX = center.x - viewerRect.left + pdfViewer.scrollLeft;
    pinchCenterY = center.y - viewerRect.top + pdfViewer.scrollTop;
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 2 && isPinching) {
    e.preventDefault();
    const currentDistance = getDistance(e.touches[0], e.touches[1]);
    const scale = currentDistance / initialPinchDistance;
    
    let newZoom = initialPinchZoom * scale;
    newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    
    const canvas = document.getElementById('pdf-canvas');
    const pdfViewer = document.getElementById('pdf-viewer');
    const scaleRatio = newZoom / initialPinchZoom;
    
    canvas.style.width = (canvasBaseWidth * scaleRatio) + 'px';
    canvas.style.height = (canvasBaseHeight * scaleRatio) + 'px';
    
    const center = getPinchCenter(e.touches[0], e.touches[1]);
    const viewerRect = pdfViewer.getBoundingClientRect();
    const currentCenterX = center.x - viewerRect.left;
    const currentCenterY = center.y - viewerRect.top;
    
    const newScrollLeft = (pinchCenterX * scaleRatio) - currentCenterX;
    const newScrollTop = (pinchCenterY * scaleRatio) - currentCenterY;
    
    pdfViewer.scrollLeft = newScrollLeft;
    pdfViewer.scrollTop = newScrollTop;
    
    pdfZoom = newZoom;
  }
}

function handleTouchEnd(e) {
  if (e.touches.length < 2 && isPinching) {
    isPinching = false;
    renderPage(currentPage);
  }
}

async function renderPage(pageNum, withTransition = false, recalculateBase = false) {
  if (!pdfDoc) return;
  
  const canvas = document.getElementById('pdf-canvas');
  
  if (withTransition) {
    canvas.classList.add('page-transition');
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  
  try {
    if (pdfRenderTask) {
      pdfRenderTask.cancel();
    }
    
    const page = await pdfDoc.getPage(pageNum);
    const ctx = canvas.getContext('2d');
    
    const viewport = page.getViewport({ scale: 1 });
    
    // Calculate base scale only on first render or when explicitly requested
    if (pdfBaseScale === 1 || recalculateBase) {
      const containerWidth = document.getElementById('pdf-viewer').clientWidth;
      pdfBaseScale = (containerWidth / viewport.width) * 0.9;
    }
    
    const finalScale = pdfBaseScale * pdfZoom;
    
    const pixelRatio = window.devicePixelRatio || 1;
    const renderScale = finalScale * pixelRatio;
    const scaledViewport = page.getViewport({ scale: renderScale });
    
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;
    
    const canvasWidth = viewport.width * finalScale;
    const canvasHeight = viewport.height * finalScale;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    
    // Center canvas dynamically
    const pdfViewer = document.getElementById('pdf-viewer');
    const containerWidth = pdfViewer.clientWidth;
    const containerHeight = pdfViewer.clientHeight;
    
    const marginLeft = Math.max(0, (containerWidth - canvasWidth) / 2);
    const marginTop = Math.max(0, (containerHeight - canvasHeight) / 2);
    canvas.style.marginLeft = marginLeft + 'px';
    canvas.style.marginTop = marginTop + 'px';
    canvas.style.marginRight = marginLeft + 'px';
    canvas.style.marginBottom = marginTop + 'px';
    
    pdfRenderTask = page.render({
      canvasContext: ctx,
      viewport: scaledViewport
    });
    
    await pdfRenderTask.promise;
    
    document.getElementById('pdf-page-info').textContent = `${pageNum} / ${totalPages}`;
    document.getElementById('pdf-total-display').textContent = totalPages;
    
    // Save reading progress immediately when page is rendered
    if (currentDetailBookId && pageNum > 0) {
      setReadingProgress(currentDetailBookId, pageNum, totalPages);
    }
    
    if (withTransition) {
      canvas.classList.remove('page-transition');
    }
  } catch (error) {
    if (error.name !== 'RenderingCancelledException') {
      console.error('Error rendering page:', error);
    }
    canvas.classList.remove('page-transition');
  }
}

function prevPage() {
  if (currentPage <= 1) return;
  currentPage--;
  renderPage(currentPage, true);
}

function nextPage() {
  if (currentPage >= totalPages) return;
  currentPage++;
  renderPage(currentPage, true);
}

function showPageInput() {
  const pageInfo = document.getElementById('pdf-page-info');
  const inputWrap = document.getElementById('pdf-page-input-wrap');
  const input = document.getElementById('pdf-page-input');
  
  pageInfo.classList.add('hidden');
  inputWrap.classList.remove('hidden');
  input.value = currentPage;
  input.max = totalPages;
  input.focus();
  input.select();
}

function hidePageInput() {
  const pageInfo = document.getElementById('pdf-page-info');
  const inputWrap = document.getElementById('pdf-page-input-wrap');
  
  pageInfo.classList.remove('hidden');
  inputWrap.classList.add('hidden');
}

function handlePageInputKey(e) {
  if (e.key === 'Enter') {
    goToPage();
  } else if (e.key === 'Escape') {
    hidePageInput();
  }
}

function goToPage() {
  const input = document.getElementById('pdf-page-input');
  let pageNum = parseInt(input.value, 10);
  
  if (isNaN(pageNum) || pageNum < 1) {
    pageNum = 1;
  } else if (pageNum > totalPages) {
    pageNum = totalPages;
  }
  
  hidePageInput();
  
  if (pageNum !== currentPage) {
    currentPage = pageNum;
    renderPage(currentPage, true);
  }
}

function zoomIn() {
  if (pdfZoom >= ZOOM_MAX) return;
  pdfZoom = Math.min(pdfZoom + ZOOM_STEP, ZOOM_MAX);
  renderPage(currentPage);
}

function zoomOut() {
  if (pdfZoom <= ZOOM_MIN) return;
  pdfZoom = Math.max(pdfZoom - ZOOM_STEP, ZOOM_MIN);
  renderPage(currentPage);
}

function resetZoom() {
  pdfZoom = 1;
  pdfBaseScale = 1;
}

function resetPdfView() {
  pdfZoom = 1;
  const pdfViewer = document.getElementById('pdf-viewer');
  pdfViewer.scrollTop = 0;
  pdfViewer.scrollLeft = 0;
  renderPage(currentPage);
}

function cleanupPinchZoom() {
  const pdfViewer = document.getElementById('pdf-viewer');
  pdfViewer.removeEventListener('touchstart', handleTouchStart);
  pdfViewer.removeEventListener('touchmove', handleTouchMove);
  pdfViewer.removeEventListener('touchend', handleTouchEnd);
}

function closeReader() {
  cleanupPinchZoom();
  
  // Save reading progress before closing
  if (currentDetailBookId && currentPage > 0) {
    setReadingProgress(currentDetailBookId, currentPage, totalPages);
  }
  
  if (pdfDoc) {
    pdfDoc.destroy();
    pdfDoc = null;
  }
  pdfRenderTask = null;
  currentPage = 1;
  totalPages = 0;
  resetZoom();
  
  const canvas = document.getElementById('pdf-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  document.getElementById('pdf-viewer').classList.remove('active');
  document.getElementById('pdf-controls').classList.remove('active');
  document.getElementById('pdf-reset-btn').classList.remove('active');
  document.getElementById('book-iframe').classList.remove('hidden');
  document.getElementById('book-iframe').src = '';
  document.getElementById('book-iframe').srcdoc = '';
  
  // Check if going back to book detail view
  const previousView = viewHistory.length > 1 ? viewHistory[viewHistory.length - 2] : 'home-view';
  
  if (previousView === 'book-detail-view') {
    // Show read button for book detail view
    document.getElementById('bottom-read-btn').classList.add('active');
  } else {
    // Show bottom navigation for other views
    document.getElementById('bottom-nav').classList.remove('hidden');
  }
  
  // Force immediate re-render after closing reader
  setTimeout(() => {
    goBack();
  }, 50);
}

function goBack() {
  if (viewHistory.length > 1) {
    const previousView = viewHistory[viewHistory.length - 2];
    setActiveView(previousView, 'back');
    
    // Update nav based on previous view and re-render content
    if (previousView === 'home-view') {
      setActiveNav('nav-home');
      renderHome();
    } else if (previousView === 'library-view') {
      setActiveNav('nav-library');
      renderLibrary();
    } else if (previousView === 'bookmarks-view') {
      setActiveNav('nav-bookmark');
      renderBookmarks();
    }
  } else {
    setActiveView('home-view', 'back');
    setActiveNav('nav-home');
    renderHome();
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);

function openSearch() {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input');
  modal.classList.add('active');
  input.value = '';
  input.focus();
  renderSearchResults('');
}

function closeSearch() {
  const modal = document.getElementById('search-modal');
  modal.classList.remove('active');
}

function handleSearch(query) {
  renderSearchResults(query);
}

function renderSearchResults(query) {
  const container = document.getElementById('search-results');
  const trimmedQuery = query.trim().toLowerCase();
  
  if (!trimmedQuery) {
    if (books.length === 0) {
      container.innerHTML = '<div class="search-empty">No books available</div>';
    } else {
      container.innerHTML = '<div class="search-empty">Start typing to search...</div>';
    }
    return;
  }
  
  const filtered = books.filter(book => 
    book.title.toLowerCase().includes(trimmedQuery) ||
    book.author.toLowerCase().includes(trimmedQuery)
  );
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="search-empty">No books found</div>';
    return;
  }
  
  container.innerHTML = filtered.map(book => `
    <div class="search-result-item" onclick="openBookFromSearch('${book.id}')">
      <div class="search-result-cover">
        ${book.coverImage 
          ? `<img src="${book.coverImage}" alt="${escapeHtml(book.title)}" />`
          : '📚'
        }
      </div>
      <div class="search-result-info">
        <div class="search-result-title">${escapeHtml(book.title)}</div>
        <div class="search-result-author">${escapeHtml(book.author)}</div>
      </div>
    </div>
  `).join('');
}

function openBookFromSearch(bookId) {
  closeSearch();
  openBookDetail(bookId);
}

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  }
  
  const searchModal = document.getElementById('search-modal');
  if (searchModal) {
    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) {
        closeSearch();
      }
    });
  }
});

function openContinueMenu(bookId, event) {
  event.preventDefault();
  event.stopPropagation();
  continueBookMenuId = bookId;
  const modal = document.getElementById('continue-menu-modal');
  modal.classList.remove('hidden');
}

function hideBookFromContinue() {
  if (continueBookMenuId) {
    hideBook(continueBookMenuId);
    closeContinueMenu();
    renderHome();
    showToast('Book hidden from Continue Reading');
  }
}

function closeContinueMenu() {
  const modal = document.getElementById('continue-menu-modal');
  modal.classList.add('hidden');
  continueBookMenuId = null;
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('continue-menu-modal');
  if (modal && !modal.classList.contains('hidden') && !e.target.closest('.continue-more-btn') && !e.target.closest('.menu-content')) {
    closeContinueMenu();
  }
});

window.showHome = showHome;
window.showLibrary = showLibrary;
window.openBook = openBook;
window.openBookDetail = openBookDetail;
window.selectDetailBook = selectDetailBook;
window.closeBookDetail = closeBookDetail;
window.startReading = startReading;
window.closeReader = closeReader;
window.goBack = goBack;
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.openBookFromSearch = openBookFromSearch;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.showPageInput = showPageInput;
window.handlePageInputKey = handlePageInputKey;
window.goToPage = goToPage;
window.openContinueMenu = openContinueMenu;
window.hideBookFromContinue = hideBookFromContinue;
window.toggleDesktopAccess = toggleDesktopAccess;
window.showBookmarks = showBookmarks;
window.toggleBookmark = toggleBookmark;
window.renderBookmarks = renderBookmarks;
window.handleUserRegistration = handleUserRegistration;
window.resetPdfView = resetPdfView;
