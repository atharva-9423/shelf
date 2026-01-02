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
  USER_STATUS: 'shelf_user_status',
  USER_LOGGED_IN: 'shelf_user_logged_in'
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
  const pendingRef = window.firebaseRef(window.firebaseDB, `pending-users/${userId}`);
  const approvedRef = window.firebaseRef(window.firebaseDB, `approved-users/${userId}`);
  
  if (userApprovalListener) return;
  
  // Listen for both pending removal and approved appearance
  userApprovalListener = window.firebaseOnValue(approvedRef, (snapshot) => {
    if (snapshot.exists()) {
      setUserStatus('approved');
      showToast('Registration approved! Please log in to continue.');
      showLoginForm();
      
      // Clean up listener once approved
      if (userApprovalListener && typeof userApprovalListener === 'function') {
        userApprovalListener();
        userApprovalListener = null;
      }
    }
  });

  // Also listen for rejection in pending
  window.firebaseOnValue(pendingRef, (snapshot) => {
    if (snapshot.exists()) {
      const userData = snapshot.val();
      if (userData.status === 'rejected') {
        setUserStatus('rejected');
        showRejectedMessage();
      }
    }
  });
}

function isUserLoggedIn() {
  return localStorage.getItem(CACHE_KEYS.USER_LOGGED_IN) === 'true';
}

function setUserLoggedIn(loggedIn) {
  if (loggedIn) {
    localStorage.setItem(CACHE_KEYS.USER_LOGGED_IN, 'true');
  } else {
    localStorage.removeItem(CACHE_KEYS.USER_LOGGED_IN);
  }
}

function showLoginForm() {
  const loadingScreen = document.getElementById('app-loading-screen');
  const loginGate = document.getElementById('login-gate-view');
  const authGate = document.getElementById('auth-gate-view');
  
  currentView = 'login-gate-view';
  if (authGate) authGate.classList.remove('active');
  if (loginGate) loginGate.classList.add('active');
  if (loadingScreen) loadingScreen.classList.add('hidden');
}

async function handleUserLogin(e) {
  e.preventDefault();
  
  const loginId = document.getElementById('login-id').value.trim();
  const loginPassword = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');
  
  if (!loginId || !loginPassword) {
    errorEl.textContent = 'Please enter both ID and password';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Signing in...</span>';
  errorEl.textContent = '';

  try {
    const userId = getUserId();
    // 1. Verify Device ID first (using the current userId from localStorage/getUserId())
    const approvedRef = window.firebaseRef(window.firebaseDB, `approved-users/${userId}`);
    const snapshot = await window.firebaseGet(approvedRef);
    
    if (snapshot.exists()) {
      const userData = snapshot.val();
      
      // 2. Check if the login ID matches
      if (userData.credentials && userData.credentials.id === loginId) {
        // 3. Check if the password matches
        if (userData.credentials.password === loginPassword) {
          // 4. Double check device ID (extra security layer)
          if (userData.deviceId === userId) {
            setUserLoggedIn(true);
            showToast('Login successful!');
            showMainApp();
          } else {
            errorEl.textContent = 'This account is not authorized for this device.';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In</span>';
          }
        } else {
          errorEl.textContent = 'Incorrect password. Please try again.';
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Sign In</span>';
        }
      } else {
        errorEl.textContent = 'Invalid User ID for this device.';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In</span>';
      }
    } else {
      // Check if user exists anywhere with these credentials to provide better error
      const allApprovedRef = window.firebaseRef(window.firebaseDB, 'approved-users');
      const allSnapshot = await window.firebaseGet(allApprovedRef);
      let foundOtherDevice = false;
      
      if (allSnapshot.exists()) {
        const allUsers = allSnapshot.val();
        for (const uid in allUsers) {
          if (allUsers[uid].credentials && allUsers[uid].credentials.id === loginId) {
            foundOtherDevice = true;
            break;
          }
        }
      }
      
      if (foundOtherDevice) {
        errorEl.textContent = 'This account is registered on another device.';
      } else {
        errorEl.textContent = 'Account not found or not yet approved.';
      }
      
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In</span>';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = 'Login failed. Please try again.';
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Sign In</span>';
  }
}

function showPendingScreen() {
  const loadingScreen = document.getElementById('app-loading-screen');
  const authGate = document.getElementById('auth-gate-view');
  const form = document.getElementById('auth-register-form');
  const pendingMessage = document.getElementById('auth-pending-message');
  
  currentView = 'auth-gate-view';
  if (authGate) authGate.classList.add('active');
  if (form) form.classList.add('hidden');
  if (pendingMessage) pendingMessage.classList.remove('hidden');
  if (loadingScreen) loadingScreen.classList.add('hidden');
}

function showMainApp() {
  const loadingScreen = document.getElementById('app-loading-screen');
  const authGate = document.getElementById('auth-gate-view');
  const loginGate = document.getElementById('login-gate-view');
  const homeView = document.getElementById('home-view');
  const globalHeader = document.getElementById('global-header');
  const bottomNav = document.getElementById('bottom-nav');
  
  currentView = 'home-view';
  if (authGate) authGate.classList.remove('active');
  if (loginGate) loginGate.classList.remove('active');
  if (homeView) homeView.classList.add('active');
  if (globalHeader) globalHeader.classList.remove('hidden');
  if (bottomNav) bottomNav.classList.remove('hidden');
  if (loadingScreen) loadingScreen.classList.add('hidden');
  
  renderHome();
  renderLibrary();
}

function showRejectedMessage() {
  const loadingScreen = document.getElementById('app-loading-screen');
  const authGate = document.getElementById('auth-gate-view');
  const pendingMessage = document.getElementById('auth-pending-message');
  
  if (authGate) authGate.classList.add('active');
  if (pendingMessage) {
    pendingMessage.innerHTML = `
      <div class="pending-icon" style="background: #fee2e2;">
        <i class="fa-solid fa-xmark" style="color: #dc2626;"></i>
      </div>
      <h3 style="color: #dc2626;">Registration Rejected</h3>
      <p style="color: #991b1b;">Your registration was not approved. Please contact the administrator.</p>
      <p style="margin-top: 12px; font-size: 0.9em; color: #991b1b; opacity: 0.8;">Check your email for any further updates or instructions.</p>
    `;
    pendingMessage.style.background = '#fef2f2';
    pendingMessage.style.borderColor = '#fecaca';
    pendingMessage.classList.remove('hidden');
  }
  if (loadingScreen) loadingScreen.classList.add('hidden');
}

function showRegistrationForm() {
  const loadingScreen = document.getElementById('app-loading-screen');
  const authGate = document.getElementById('auth-gate-view');
  if (authGate) authGate.classList.add('active');
  if (loadingScreen) loadingScreen.classList.add('hidden');
}

async function handleUserRegistration(e) {
  e.preventDefault();
  
  const name = document.getElementById('user-name').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const college = document.getElementById('user-college').value.trim();
  const phone = document.getElementById('user-phone').value.trim();
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');
  
  if (!name || !email || !college || !phone) {
    errorEl.textContent = 'Please fill in all fields';
    return;
  }

  if (phone.length !== 10 || !/^\d+$/.test(phone)) {
    errorEl.textContent = 'Please enter a valid 10-digit mobile number';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Checking...</span>';
  errorEl.textContent = '';

  try {
    const userId = getUserId();
    
    // 1. Check if this device is already registered with ANY email
    const deviceBindingRef = window.firebaseRef(window.firebaseDB, `device-bindings/${userId}`);
    const deviceSnapshot = await window.firebaseGet(deviceBindingRef);
    
    if (deviceSnapshot.exists()) {
      const existingEmail = deviceSnapshot.val().email;
      if (existingEmail && existingEmail.toLowerCase() !== email.toLowerCase()) {
        errorEl.textContent = `This device is already registered to another email. Only one account per device is allowed.`;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Submit Registration</span>';
        return;
      }
    }

    // 2. Check if this email is already registered on ANOTHER device
    const emailKey = email.toLowerCase().replace(/[.#$[\]]/g, '_');
    const emailBindingRef = window.firebaseRef(window.firebaseDB, `email-bindings/${emailKey}`);
    const emailSnapshot = await window.firebaseGet(emailBindingRef);
    
    if (emailSnapshot.exists()) {
      const registeredDeviceId = emailSnapshot.val().deviceId;
      if (registeredDeviceId !== userId) {
        errorEl.textContent = `This email is already registered on another device.`;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Submit Registration</span>';
        return;
      }
    }
    
    submitBtn.innerHTML = '<span>Submitting...</span>';
    
    const userRef = window.firebaseRef(window.firebaseDB, `pending-users/${userId}`);
    
    await window.firebaseSet(userRef, {
      name,
      email,
      college,
      phone: '+91' + phone,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      deviceId: userId
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
    const header = document.getElementById('global-header');
    const bottomNav = document.getElementById('bottom-nav');
    const bottomReadBtn = document.getElementById('bottom-read-btn');
    if (header) header.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';
    if (bottomReadBtn) bottomReadBtn.style.display = 'none';
    
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
    if (!cached) uncachedBooks.push(bookId);
  }
  if (uncachedBooks.length === 0) return;
  isSyncing = true;
  syncProgress = { total: uncachedBooks.length, completed: 0 };
  for (const bookId of uncachedBooks) {
    try {
      const fileRef = window.firebaseRef(window.firebaseDB, `book-files/${bookId}`);
      const snapshot = await window.firebaseGet(fileRef);
      if (snapshot.exists()) {
        const fileData = snapshot.val();
        await saveBookFileToCache(bookId, fileData);
        fileCache.set(bookId, fileData);
        syncProgress.completed++;
      }
    } catch (error) {
      console.error(`Failed to cache book ${bookId}:`, error);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  isSyncing = false;
  showToast('Books cached for offline reading!');
  if (syncQueue.length > 0) {
    const nextBatch = [...syncQueue];
    syncQueue = [];
    syncAllBooksToCache(nextBatch);
  }
}

async function syncNewBooks(currentBookIds, previousBookIds) {
  const newBookIds = currentBookIds.filter(id => !previousBookIds.includes(id));
  if (newBookIds.length > 0) {
    showToast(`New book detected! Downloading...`);
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
  if (hour >= 5 && hour < 12) greeting = 'Good morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17 && hour < 21) greeting = 'Good evening';
  else greeting = 'Good night';
  const greetingEl = document.getElementById('greeting-text');
  if (greetingEl) greetingEl.textContent = greeting;
}

function initCustomSelects() {
  const customSelects = document.querySelectorAll('.custom-select');
  customSelects.forEach(select => {
    const selected = select.querySelector('.select-selected');
    const items = select.querySelector('.select-items');
    const hiddenInput = select.nextElementSibling;
    selected.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllSelect(selected);
      items.classList.toggle('select-hide');
      select.classList.toggle('select-arrow-active');
    });
    const options = items.querySelectorAll('div');
    options.forEach(option => {
      option.addEventListener('click', () => {
        const val = option.getAttribute('data-value');
        selected.textContent = option.textContent;
        hiddenInput.value = val;
        options.forEach(opt => opt.classList.remove('same-as-selected'));
        option.classList.add('same-as-selected');
        items.classList.add('select-hide');
        select.classList.remove('select-arrow-active');
      });
    });
  });
  document.addEventListener('click', () => closeAllSelect());
}

function closeAllSelect(elmnt) {
  const items = document.getElementsByClassName('select-items');
  const selected = document.getElementsByClassName('select-selected');
  for (let i = 0; i < selected.length; i++) {
    if (elmnt == selected[i]) continue;
    selected[i].parentElement.classList.remove('select-arrow-active');
  }
  for (let i = 0; i < items.length; i++) {
    if (elmnt && elmnt.nextElementSibling == items[i]) continue;
    items[i].classList.add('select-hide');
  }
}

async function init() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const pathHasAdmin = window.location.pathname.includes('/admin');
    if (urlParams.has('admin') || hashParams.has('admin') || pathHasAdmin || window.location.search.includes('admin') || window.location.hash.includes('admin')) {
      window.location.href = '/admin.html';
      return;
    }
    await waitForFirebase();
    firebaseReady = true;
    initCustomSelects();
    await fetchDesktopAccessFromDB();
    checkDesktopAccess();
    
    // Always start listening for books immediately
    setupFirebaseListener();
    
    const userStatus = await checkUserApprovalStatus();
    if (userStatus === 'approved') {
      if (isUserLoggedIn()) {
        showMainApp();
        // Ensure nav indicator is positioned after showing main app
        setTimeout(() => {
          initNavIndicator();
        }, 100);
      } else {
        showLoginForm();
        listenForApproval();
      }
    }
    else if (userStatus === 'pending') {
      showPendingScreen();
      listenForApproval();
    } else if (userStatus === 'rejected') {
      showRejectedMessage();
    } else {
      showRegistrationForm();
    }
    
    isLoading = true;
    showSkeletons();
    updateGreeting();
    initHistoryState();
    await openBooksDatabase();
    
    lastReadBook = localStorage.getItem('shelf_last_read');
    const cachedMeta = getCachedBooksMeta();
    if (cachedMeta) {
      books = Object.entries(cachedMeta).map(([id, book]) => ({...book, id, isNewFormat: true}));
      books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      isLoading = false;
      renderHome();
      renderLibrary();
    }
    
    setInterval(() => {
      const activeView = document.querySelector('.view.active');
      if (activeView) {
        if (activeView.id === 'home-view') renderHome();
        else if (activeView.id === 'library-view') renderLibrary();
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
  if (carousel) carousel.innerHTML = Array(4).fill('').map(() => `<div class="carousel-book skeleton-book"><div class="carousel-book-cover skeleton"></div><div class="skeleton skeleton-text" style="width: 60%; height: 14px; margin-top: 8px;"></div></div>`).join('');
  if (grid) grid.innerHTML = Array(6).fill('').map(() => `<div class="library-book skeleton-book"><div class="library-book-cover skeleton"></div><div class="skeleton skeleton-text" style="width: 80%; height: 14px; margin-top: 8px;"></div><div class="skeleton skeleton-text" style="width: 50%; height: 12px; margin-top: 4px;"></div></div>`).join('');
  if (continueSection && continueCard) {
    continueSection.classList.remove('hidden');
    continueCard.innerHTML = `<div class="continue-book-cover skeleton"></div><div class="continue-book-info"><div class="skeleton skeleton-text" style="width: 70%; height: 18px;"></div><div class="skeleton skeleton-text" style="width: 50%; height: 14px; margin-top: 8px;"></div><div class="skeleton skeleton-text" style="width: 40%; height: 12px; margin-top: 8px;"></div><div class="skeleton skeleton-text" style="width: 100%; height: 8px; margin-top: 12px; border-radius: 4px;"></div><div class="skeleton skeleton-text" style="width: 80px; height: 32px; margin-top: 12px; border-radius: 20px;"></div></div>`;
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
      
      // Update local storage cache
      saveBooksMetaToCache(data);
      
      // Update in-memory books array
      books = Object.entries(data).map(([id, book]) => ({...book, id, isNewFormat: true}));
      books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // For first-time users or if cache was empty, start full sync
      if (previousBookIds.length === 0 && cachedBookIds.length === 0) {
        previousBookIds = currentBookIds;
        syncAllBooksToCache(currentBookIds);
      } else if (JSON.stringify(currentBookIds.sort()) !== JSON.stringify(cachedBookIds.sort())) {
        // If there are differences between cloud and cache, sync new ones
        syncNewBooks(currentBookIds, cachedBookIds);
        previousBookIds = currentBookIds;
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
  });
}

async function getBookFileData(bookId) {
  if (fileCache.has(bookId)) return fileCache.get(bookId);
  const cached = await getBookFileFromCache(bookId);
  if (cached) {
    fileCache.set(bookId, cached);
    return cached;
  }
  try {
    const fileRef = window.firebaseRef(window.firebaseDB, `book-files/${bookId}`);
    const snapshot = await window.firebaseGet(fileRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      await saveBookFileToCache(bookId, data);
      fileCache.set(bookId, data);
      return data;
    }
  } catch (error) {
    console.error('Error fetching book file:', error);
  }
  return null;
}

let viewHistory = ['home-view'];
let currentView = 'home-view';
let isHandlingPopstate = false;

function initHistoryState() {
  const state = { viewId: currentView };
  history.replaceState(state, '', window.location.pathname);
}

function pushHistoryState(viewId) {
  const state = { viewId };
  history.pushState(state, '', window.location.pathname);
}

window.addEventListener('popstate', (event) => {
  if (isHandlingPopstate) return;
  isHandlingPopstate = true;
  
  const viewId = (event.state && event.state.viewId) ? event.state.viewId : 'home-view';
  
  // Handle the logic to switch to the previous view
  if (viewId !== currentView) {
    // Determine the direction for the animation
    setActiveView(viewId, 'back');
    
    // Update navigation items based on the view
    if (viewId === 'home-view') {
      setActiveNav('nav-home');
      renderHome();
    } else if (viewId === 'library-view') {
      setActiveNav('nav-library');
      renderLibrary();
    } else if (viewId === 'bookmarks-view') {
      setActiveNav('nav-bookmark');
      renderBookmarks();
    }
  }
  
  setTimeout(() => isHandlingPopstate = false, 350);
});

function setActiveView(viewId, direction = 'forward') {
  if (currentView === viewId) return;
  
  const currentViewEl = document.getElementById(currentView);
  const newViewEl = document.getElementById(viewId);
  
  if (!currentViewEl || !newViewEl) return;
  
  const globalHeader = document.getElementById('global-header');
  
  // Show header for standard views, hide for specific ones like PDF
  if (['home-view', 'book-detail-view', 'library-view', 'bookmarks-view'].includes(viewId)) {
    globalHeader.classList.remove('hidden');
  } else {
    globalHeader.classList.add('hidden');
  }
  
  // Clean up any existing animation classes
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  });
  
  currentView = viewId;
  newViewEl.classList.add('active');
  
  if (direction === 'forward') {
    currentViewEl.classList.add('slide-out-left');
    newViewEl.classList.add('slide-in-right');
    if (!isHandlingPopstate) {
      pushHistoryState(viewId);
    }
  } else {
    currentViewEl.classList.add('slide-out-right');
    newViewEl.classList.add('slide-in-left');
  }
  
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
  if (activeNav) updateNavIndicator(activeNav);
}

window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch((err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  }
  // Disable right-click
  document.addEventListener('contextmenu', e => e.preventDefault());
  
  // Disable common dev tools shortcuts
  document.addEventListener('keydown', e => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
      (e.ctrlKey && e.key === 'U') ||
      (e.metaKey && e.altKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C')) ||
      (e.metaKey && e.key === 'u')
    ) {
      e.preventDefault();
      return false;
    }
  });
  
  initNavIndicator();
});
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
  carousel.innerHTML = books.map(book => `<div class="carousel-book" onclick="openBookDetail('${book.id}')"><div class="carousel-book-cover">${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}">` : '📚'}</div><div class="carousel-book-author">${escapeHtml(book.author)}</div></div>`).join('');
  continueSection.classList.remove('hidden');
  const startedBooks = getStartedBooks();
  if (startedBooks.length > 0) {
    const progress = getReadingProgress();
    const continueBook = startedBooks[0];
    const bookProgress = progress[continueBook.id];
    const progressPercent = Math.round((bookProgress.currentPage / bookProgress.totalPages) * 100);
    continueCard.innerHTML = `<div class="continue-book-cover" onclick="openBook('${continueBook.id}')">${continueBook.cover ? `<img src="${continueBook.cover}" alt="${escapeHtml(continueBook.title)}">` : '📖'}</div><div class="continue-book-info"><div class="continue-book-title">${escapeHtml(continueBook.title)}</div><div class="continue-book-chapter">Page ${bookProgress.currentPage} of ${bookProgress.totalPages}</div><div class="continue-book-rating"><span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star empty">★</span></div><div class="progress-row"><div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%"></div></div><span class="progress-text">${progressPercent}%</span></div><button class="play-btn" onclick="openBook('${continueBook.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>Play</button></div><button class="continue-more-btn" onclick="openContinueMenu('${continueBook.id}', event)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>`;
  } else {
    continueCard.innerHTML = `<div class="continue-empty"><div class="continue-empty-icon">📖</div><p class="continue-empty-title">Start Reading</p><p class="continue-empty-text">You haven't started reading any books yet. Pick a book and start your reading journey!</p></div>`;
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
  grid.innerHTML = books.map(book => `<div class="library-book" onclick="openBookDetail('${book.id}')"><div class="library-book-cover">${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}">` : '📖'}</div><div class="library-book-title">${escapeHtml(book.title)}</div><div class="library-book-author">${escapeHtml(book.author)}</div></div>`).join('');
}

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let pdfRenderTask = null;
let pdfZoom = 1;
let pdfBaseScale = 1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.2;

let initialPinchDistance = 0;
let initialPinchZoom = 1;
let isPinching = false;
let currentDetailBookId = null;
let continueBookMenuId = null;

function openBookDetail(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  currentDetailBookId = id;
  document.getElementById('bottom-nav').classList.add('nav-hidden');
  setTimeout(() => document.getElementById('bottom-read-btn').classList.add('active'), 150);
  document.getElementById('global-header').classList.add('show-back');
  setActiveView('book-detail-view');
  renderDetailCarousel();
  updateDetailInfo();
}

function renderDetailCarousel() {
  const carousel = document.getElementById('detail-books-carousel');
  const book = books.find(b => b.id === currentDetailBookId);
  if (!book) return;
  
  carousel.innerHTML = `
    <div class="detail-book-card active">
      ${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}">` : `<div class="placeholder">📚</div>`}
    </div>
  `;
}

function getBookmarkedBooks() {
  try {
    const bookmarks = localStorage.getItem(CACHE_KEYS.BOOKMARKS);
    return bookmarks ? JSON.parse(bookmarks) : {};
  } catch { return {}; }
}

function toggleBookmark(bookId) {
  const id = bookId || currentDetailBookId;
  if (!id) return;
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
}

function updateDetailInfo() {
  const book = books.find(b => b.id === currentDetailBookId);
  if (!book) return;
  document.getElementById('detail-author').textContent = book.author.toUpperCase();
  document.getElementById('detail-description').textContent = book.description || 'No description available for this book.';
  document.getElementById('detail-pages').textContent = book.pages || '--';
  const bookmarks = getBookmarkedBooks();
  const bookmarkBtn = document.getElementById('detail-bookmark-btn');
  if (bookmarkBtn) {
    bookmarkBtn.classList.toggle('bookmarked', !!bookmarks[currentDetailBookId]);
    bookmarkBtn.innerHTML = bookmarks[currentDetailBookId] ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';
  }
}

function closeBookDetail() {
  document.getElementById('bottom-read-btn').classList.remove('active');
  setTimeout(() => {
    document.getElementById('bottom-nav').classList.remove('nav-hidden');
    setTimeout(() => {
      setActiveNav('nav-home');
      initNavIndicator();
      renderHome();
    }, 300);
  }, 150);
  document.getElementById('global-header').classList.remove('show-back');
  setActiveView('home-view', 'back');
}

function startReading() {
  if (currentDetailBookId) {
    document.getElementById('bottom-read-btn').classList.remove('active');
    openBook(currentDetailBookId);
  }
}

async function openBook(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  localStorage.setItem('shelf_last_read', id);
  lastReadBook = id;
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
    iframe.srcdoc = `<!DOCTYPE html><html><head><style>body { font-family: system-ui, sans-serif; padding: 48px 24px; max-width: 640px; margin: 0 auto; color: #1a1a1a; } a { color: #1a1a1a; }</style></head><body><p style="color: #666;">EPUB files require additional processing. The file has been stored successfully.</p><p><a href="${fileData}" download="${escapeHtml(book.fileName)}">Download ${escapeHtml(book.fileName)}</a></p></body></html>`;
  }
}

async function renderPdf(dataUrl, bookId) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    totalPages = pdfDoc.numPages;
    const progress = getReadingProgress();
    currentPage = (progress[bookId] && progress[bookId].currentPage > 0) ? Math.min(progress[bookId].currentPage, totalPages) : 1;
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

let canvasBaseWidth = 0, canvasBaseHeight = 0, initialScrollLeft = 0, initialScrollTop = 0, pinchCenterX = 0, pinchCenterY = 0;

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
    const touch1 = e.touches[0], touch2 = e.touches[1];
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;
    const viewerRect = pdfViewer.getBoundingClientRect();
    pinchCenterX = centerX - viewerRect.left + pdfViewer.scrollLeft;
    pinchCenterY = centerY - viewerRect.top + pdfViewer.scrollTop;
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 2 && isPinching) {
    e.preventDefault();
    const currentDistance = getDistance(e.touches[0], e.touches[1]);
    const scale = currentDistance / initialPinchDistance;
    let newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, initialPinchZoom * scale));
    const canvas = document.getElementById('pdf-canvas');
    const pdfViewer = document.getElementById('pdf-viewer');
    const scaleRatio = newZoom / initialPinchZoom;
    canvas.style.width = (canvasBaseWidth * scaleRatio) + 'px';
    canvas.style.height = (canvasBaseHeight * scaleRatio) + 'px';
    const touch1 = e.touches[0], touch2 = e.touches[1];
    const currentCenterX = ((touch1.clientX + touch2.clientX) / 2) - pdfViewer.getBoundingClientRect().left;
    pdfViewer.scrollLeft = (pinchCenterX * scaleRatio) - currentCenterX;
    pdfViewer.scrollTop = (pinchCenterY * scaleRatio) - (((touch1.clientY + touch2.clientY) / 2) - pdfViewer.getBoundingClientRect().top);
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
    if (pdfRenderTask) pdfRenderTask.cancel();
    const page = await pdfDoc.getPage(pageNum);
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: 1 });
    if (pdfBaseScale === 1 || recalculateBase) {
      pdfBaseScale = (document.getElementById('pdf-viewer').clientWidth / viewport.width) * 0.9;
    }
    const finalScale = pdfBaseScale * pdfZoom;
    const pixelRatio = window.devicePixelRatio || 1;
    const scaledViewport = page.getViewport({ scale: finalScale * pixelRatio });
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;
    const canvasWidth = viewport.width * finalScale;
    const canvasHeight = viewport.height * finalScale;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    const pdfViewer = document.getElementById('pdf-viewer');
    const marginLeft = Math.max(0, (pdfViewer.clientWidth - canvasWidth) / 2);
    const marginTop = Math.max(0, (pdfViewer.clientHeight - canvasHeight) / 2);
    canvas.style.marginLeft = marginLeft + 'px';
    canvas.style.marginTop = marginTop + 'px';
    pdfRenderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
    await pdfRenderTask.promise;
    document.getElementById('pdf-page-info').textContent = `${pageNum} / ${totalPages}`;
    document.getElementById('pdf-total-display').textContent = totalPages;
    if (currentDetailBookId && pageNum > 0) setReadingProgress(currentDetailBookId, pageNum, totalPages);
    if (withTransition) canvas.classList.remove('page-transition');
  } catch (error) {
    if (error.name !== 'RenderingCancelledException') console.error('Error rendering page:', error);
    canvas.classList.remove('page-transition');
  }
}

function prevPage() { if (currentPage > 1) { currentPage--; renderPage(currentPage, true); } }
function nextPage() { if (currentPage < totalPages) { currentPage++; renderPage(currentPage, true); } }
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
  document.getElementById('pdf-page-info').classList.remove('hidden');
  document.getElementById('pdf-page-input-wrap').classList.add('hidden');
}
function handlePageInputKey(e) { if (e.key === 'Enter') goToPage(); else if (e.key === 'Escape') hidePageInput(); }
function goToPage() {
  const input = document.getElementById('pdf-page-input');
  let pageNum = parseInt(input.value, 10);
  if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
  else if (pageNum > totalPages) pageNum = totalPages;
  hidePageInput();
  if (pageNum !== currentPage) { currentPage = pageNum; renderPage(currentPage, true); }
}
function zoomIn() { if (pdfZoom < ZOOM_MAX) { pdfZoom = Math.min(pdfZoom + ZOOM_STEP, ZOOM_MAX); renderPage(currentPage); } }
function zoomOut() { if (pdfZoom > ZOOM_MIN) { pdfZoom = Math.max(pdfZoom - ZOOM_STEP, ZOOM_MIN); renderPage(currentPage); } }
function resetZoom() { pdfZoom = 1; pdfBaseScale = 1; }
function resetPdfView() { pdfZoom = 1; const v = document.getElementById('pdf-viewer'); v.scrollTop = 0; v.scrollLeft = 0; renderPage(currentPage); }

function closeReader() {
  const pdfViewer = document.getElementById('pdf-viewer');
  pdfViewer.removeEventListener('touchstart', handleTouchStart);
  pdfViewer.removeEventListener('touchmove', handleTouchMove);
  pdfViewer.removeEventListener('touchend', handleTouchEnd);
  if (currentDetailBookId && currentPage > 0) setReadingProgress(currentDetailBookId, currentPage, totalPages);
  if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null; }
  pdfRenderTask = null;
  currentPage = 1;
  totalPages = 0;
  resetZoom();
  const canvas = document.getElementById('pdf-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById('pdf-viewer').classList.remove('active');
  document.getElementById('pdf-controls').classList.remove('active');
  document.getElementById('pdf-reset-btn').classList.remove('active');
  const iframe = document.getElementById('book-iframe');
  iframe.classList.remove('hidden');
  iframe.src = '';
  iframe.srcdoc = '';
  const previousView = viewHistory.length > 1 ? viewHistory[viewHistory.length - 2] : 'home-view';
  if (previousView === 'book-detail-view') document.getElementById('bottom-read-btn').classList.add('active');
  else document.getElementById('bottom-nav').classList.remove('hidden');
  setTimeout(() => goBack(), 50);
}

function goBack() {
  if (viewHistory.length > 1) {
    const previousView = viewHistory[viewHistory.length - 2];
    setActiveView(previousView, 'back');
    if (previousView === 'home-view') { setActiveNav('nav-home'); renderHome(); }
    else if (previousView === 'library-view') { setActiveNav('nav-library'); renderLibrary(); }
    else if (previousView === 'bookmarks-view') { setActiveNav('nav-bookmark'); renderBookmarks(); }
  } else { setActiveView('home-view', 'back'); setActiveNav('nav-home'); renderHome(); }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
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

function closeSearch() { document.getElementById('search-modal').classList.remove('active'); }
function handleSearch(query) { renderSearchResults(query); }

function renderSearchResults(query) {
  const container = document.getElementById('search-results');
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    container.innerHTML = books.length === 0 ? '<div class="search-empty">No books available</div>' : '<div class="search-empty">Start typing to search...</div>';
    return;
  }
  const filtered = books.filter(book => book.title.toLowerCase().includes(trimmedQuery) || book.author.toLowerCase().includes(trimmedQuery));
  if (filtered.length === 0) { container.innerHTML = '<div class="search-empty">No books found</div>'; return; }
  container.innerHTML = filtered.map(book => `<div class="search-result-item" onclick="openBookFromSearch('${book.id}')"><div class="search-result-cover">${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}" />` : '📚'}</div><div class="search-result-info"><div class="search-result-title">${escapeHtml(book.title)}</div><div class="search-result-author">${escapeHtml(book.author)}</div></div></div>`).join('');
}

function openBookFromSearch(bookId) { closeSearch(); openBookDetail(bookId); }

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  const searchModal = document.getElementById('search-modal');
  if (searchModal) searchModal.addEventListener('click', (e) => { if (e.target === searchModal) closeSearch(); });
});

function openContinueMenu(bookId, event) {
  event.preventDefault();
  event.stopPropagation();
  continueBookMenuId = bookId;
  document.getElementById('continue-menu-modal').classList.remove('hidden');
}

function hideBookFromContinue() {
  if (continueBookMenuId) {
    hideBook(continueBookMenuId);
    closeContinueMenu();
    renderHome();
    showToast('Book hidden from Continue Reading');
  }
}

function closeContinueMenu() { document.getElementById('continue-menu-modal').classList.add('hidden'); continueBookMenuId = null; }

document.addEventListener('click', (e) => {
  const modal = document.getElementById('continue-menu-modal');
  if (modal && !modal.classList.contains('hidden') && !e.target.closest('.continue-more-btn') && !e.target.closest('.menu-content')) closeContinueMenu();
});

window.showHome = () => { setActiveView('home-view'); setActiveNav('nav-home'); renderHome(); };
window.showLibrary = () => { setActiveView('library-view'); setActiveNav('nav-library'); renderLibrary(); };
window.openBook = openBook;
window.openBookDetail = openBookDetail;
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
window.hidePageInput = hidePageInput;
window.handlePageInputKey = handlePageInputKey;
window.goToPage = goToPage;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetPdfView = resetPdfView;
window.toggleBookmark = toggleBookmark;
window.handleUserRegistration = handleUserRegistration;
window.handleUserLogin = handleUserLogin;
window.toggleDesktopAccess = toggleDesktopAccess;
window.openContinueMenu = openContinueMenu;
window.hideBookFromContinue = hideBookFromContinue;
window.closeContinueMenu = closeContinueMenu;

window.scrollCarousel = function(direction) {
  const carousel = document.getElementById('books-carousel');
  if (carousel) {
    const scrollAmount = 166; // 150px width + 16px gap
    carousel.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
    // The scroll listener will handle updating buttons
  }
};

window.updateCarouselButtons = function() {
  const carousel = document.getElementById('books-carousel');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  
  if (!carousel || !prevBtn || !nextBtn) return;
  
  // Show/hide prev button
  if (carousel.scrollLeft <= 5) {
    prevBtn.classList.add('hidden');
  } else {
    prevBtn.classList.remove('hidden');
  }
  
  // Show/hide next button
  const isAtEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 5;
  if (isAtEnd) {
    nextBtn.classList.add('hidden');
  } else {
    nextBtn.classList.remove('hidden');
  }
};

// Update buttons after rendering home
const originalRenderHome = window.renderHome;
window.renderHome = function() {
  if (typeof originalRenderHome === 'function') {
    originalRenderHome();
    setTimeout(window.updateCarouselButtons, 100);
  }
};

window.togglePasswordVisibility = function() {
  const passwordInput = document.getElementById('login-password');
  const toggleBtn = document.getElementById('toggle-password');
  const icon = toggleBtn.querySelector('i');
  
  if (passwordInput.style.webkitTextSecurity === 'disc') {
    passwordInput.style.webkitTextSecurity = 'none';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passwordInput.style.webkitTextSecurity = 'disc';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
};
