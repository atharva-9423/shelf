const ADMIN_USERNAME = 'atharva_phatangare';
const ADMIN_PASSWORD = 'atharva@1408';

let isLoggedIn = false;
let books = [];
let pendingUsers = [];
let firebaseReady = false;

const firebaseConfig = {
  apiKey: "AIzaSyDLnZu7F42nu1UnqHkyWzClB5AX25Jds0o",
  authDomain: "e-book-4f4f8.firebaseapp.com",
  databaseURL: "https://e-book-4f4f8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "e-book-4f4f8",
  storageBucket: "e-book-4f4f8.firebasestorage.app",
  messagingSenderId: "1052383218826",
  appId: "1:1052383218826:web:7c2e30520bf58177773173",
  measurementId: "G-5X14495FLX"
};

async function initFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getDatabase, ref, get, push, set, update, remove, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
    
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    
    window.firebaseDB = db;
    window.firebaseRef = ref;
    window.firebaseGet = get;
    window.firebasePush = push;
    window.firebaseSet = set;
    window.firebaseUpdate = update;
    window.firebaseRemove = remove;
    window.firebaseOnValue = onValue;
    
    firebaseReady = true;
    
    onValue(ref(db, 'book-meta'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        books = Object.entries(data).map(([id, book]) => ({
          id,
          ...book
        }));
      } else {
        books = [];
      }
      renderAdminBooks();
    });
    
    onValue(ref(db, 'pending-users'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        pendingUsers = Object.entries(data).map(([id, user]) => ({
          id,
          ...user
        })).filter(user => user.status === 'pending');
      } else {
        pendingUsers = [];
      }
      renderPendingUsers();
    });
    
    checkAdminSession();
    
  } catch (error) {
    console.error('Firebase init error:', error);
  }
}

function checkAdminSession() {
  const session = sessionStorage.getItem('shelf_admin');
  if (session === 'true') {
    isLoggedIn = true;
    showAdminPanel();
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    isLoggedIn = true;
    sessionStorage.setItem('shelf_admin', 'true');
    showAdminPanel();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    errorEl.textContent = '';
  } else {
    errorEl.textContent = 'Invalid username or password';
  }
}

function handleLogout() {
  isLoggedIn = false;
  sessionStorage.removeItem('shelf_admin');
  hideAdminPanel();
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
  
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.getElementById(`admin-tab-${tabName}`).classList.add('active');
}

async function showAdminPanel() {
  document.getElementById('admin-login').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  renderAdminBooks();
  
  await fetchDesktopAccessFromDB();
  const toggle = document.getElementById('allow-desktops-toggle');
  if (toggle) {
    toggle.checked = isDesktopAccessAllowed();
  }
}

function hideAdminPanel() {
  document.getElementById('admin-login').classList.remove('hidden');
  document.getElementById('admin-panel').classList.add('hidden');
}

async function handleUpload(e) {
  e.preventDefault();
  
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const description = document.getElementById('book-description').value.trim();
  const coverInput = document.getElementById('book-cover');
  const fileInput = document.getElementById('book-file');
  
  if (!title || !author || !fileInput.files[0]) {
    showToast('Please fill in required fields');
    return;
  }
  
  const bookFile = fileInput.files[0];
  const coverFile = coverInput.files[0];
  
  const maxSize = 10 * 1024 * 1024;
  if (bookFile.size > maxSize) {
    showToast('File too large. Maximum 10MB for Firebase.');
    return;
  }
  
  showToast('Uploading to cloud...');
  
  try {
    const bookData = await readFileAsDataURL(bookFile);
    let coverData = null;
    
    if (coverFile) {
      coverData = await readFileAsDataURL(coverFile);
    }
    
    await addBook(title, author, description, coverData, bookData, bookFile.name);
    document.getElementById('upload-form').reset();
    showToast('Book uploaded successfully!');
  } catch (error) {
    console.error('Upload error:', error);
    showToast('Upload failed. Please try again.');
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

async function addBook(title, author, description, cover, fileData, fileName) {
  const metaRef = window.firebaseRef(window.firebaseDB, 'book-meta');
  const newBookRef = window.firebasePush(metaRef);
  const bookId = newBookRef.key;
  
  const bookMeta = {
    title,
    author,
    description,
    cover,
    fileName,
    createdAt: new Date().toISOString()
  };
  
  await window.firebaseSet(newBookRef, bookMeta);
  
  const fileRef = window.firebaseRef(window.firebaseDB, `book-files/${bookId}`);
  await window.firebaseSet(fileRef, fileData);
}

async function deleteBook(bookId) {
  if (!confirm('Are you sure you want to delete this book?')) return;
  
  try {
    await window.firebaseRemove(window.firebaseRef(window.firebaseDB, `book-meta/${bookId}`));
    await window.firebaseRemove(window.firebaseRef(window.firebaseDB, `book-files/${bookId}`));
    showToast('Book deleted');
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete book');
  }
}

function renderAdminBooks() {
  const list = document.getElementById('admin-books-list');
  const empty = document.getElementById('admin-empty-state');
  
  if (!list || !empty) return;
  
  if (books.length === 0) {
    list.innerHTML = '';
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  list.classList.remove('hidden');
  
  list.innerHTML = books.map(book => `
    <div class="admin-book-item">
      <div class="admin-book-info">
        <div class="admin-book-thumb">
          ${book.cover ? `<img src="${book.cover}" alt="${escapeHtml(book.title)}">` : '📖'}
        </div>
        <div class="admin-book-details">
          <h4>${escapeHtml(book.title)}</h4>
          <p>${escapeHtml(book.author)}</p>
        </div>
      </div>
      <button class="btn btn-danger" onclick="deleteBook('${book.id}')">Delete</button>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

async function migrateOldBooks() {
  const migrateBtn = document.getElementById('migrate-btn');
  migrateBtn.disabled = true;
  migrateBtn.textContent = 'Checking...';
  
  try {
    const oldBooksRef = window.firebaseRef(window.firebaseDB, 'books');
    const snapshot = await window.firebaseGet(oldBooksRef);
    
    if (!snapshot.exists()) {
      showToast('No old books to migrate');
      migrateBtn.disabled = false;
      migrateBtn.textContent = 'Migrate';
      document.getElementById('migration-card').classList.add('hidden');
      return;
    }
    
    const oldData = snapshot.val();
    const oldBooks = Object.entries(oldData);
    
    migrateBtn.textContent = `Migrating ${oldBooks.length}...`;
    showToast(`Migrating ${oldBooks.length} book(s)...`);
    
    let migrated = 0;
    let failed = 0;
    
    for (const [id, book] of oldBooks) {
      try {
        const updates = {};
        updates[`book-meta/${id}`] = {
          title: book.title,
          author: book.author,
          description: book.description,
          cover: book.cover,
          fileName: book.fileName,
          createdAt: book.createdAt
        };
        updates[`book-files/${id}`] = book.fileData;
        updates[`books/${id}`] = null;
        
        await window.firebaseUpdate(window.firebaseRef(window.firebaseDB), updates);
        migrated++;
      } catch (error) {
        console.error(`Failed to migrate book ${id}:`, error);
        failed++;
      }
    }
    
    migrateBtn.disabled = false;
    migrateBtn.textContent = 'Migrate';
    
    if (failed === 0) {
      showToast(`Successfully migrated ${migrated} book(s)!`);
      document.getElementById('migration-card').classList.add('hidden');
    } else {
      showToast(`Migrated ${migrated}, failed ${failed}`);
    }
  } catch (error) {
    console.error('Migration error:', error);
    showToast('Migration failed');
    migrateBtn.disabled = false;
    migrateBtn.textContent = 'Migrate';
  }
}

const CACHE_KEYS = {
  ALLOW_DESKTOPS: 'shelf_allow_desktops'
};

let desktopAccessAllowed = true;

function isDesktopAccessAllowed() {
  return desktopAccessAllowed;
}

async function fetchDesktopAccessFromDB() {
  try {
    const settingsRef = window.firebaseRef(window.firebaseDB, 'settings/allowDesktops');
    const snapshot = await window.firebaseGet(settingsRef);
    
    if (snapshot.exists()) {
      desktopAccessAllowed = snapshot.val() === true;
    } else {
      desktopAccessAllowed = true;
    }
    
    localStorage.setItem(CACHE_KEYS.ALLOW_DESKTOPS, desktopAccessAllowed.toString());
  } catch (error) {
    console.error('Error fetching desktop access setting:', error);
    const cached = localStorage.getItem(CACHE_KEYS.ALLOW_DESKTOPS);
    desktopAccessAllowed = cached !== 'false';
  }
}

async function toggleDesktopAccess() {
  const toggle = document.getElementById('allow-desktops-toggle');
  const newValue = toggle.checked;
  
  try {
    const settingsRef = window.firebaseRef(window.firebaseDB, 'settings/allowDesktops');
    await window.firebaseSet(settingsRef, newValue);
    desktopAccessAllowed = newValue;
    localStorage.setItem(CACHE_KEYS.ALLOW_DESKTOPS, newValue.toString());
    showToast(newValue ? 'Desktop access enabled' : 'Desktop access disabled');
  } catch (error) {
    console.error('Error updating desktop access:', error);
    toggle.checked = !newValue;
    showToast('Failed to update setting');
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function renderPendingUsers() {
  const list = document.getElementById('pending-users-list');
  const empty = document.getElementById('pending-users-empty');
  
  if (!list || !empty) return;
  
  if (pendingUsers.length === 0) {
    list.innerHTML = '';
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  list.classList.remove('hidden');
  
  list.innerHTML = pendingUsers.map(user => `
    <div class="pending-user-card">
      <div class="pending-user-info">
        <div class="pending-user-header">
          <h4>${escapeHtml(user.name)}</h4>
          <span class="pending-badge">Pending</span>
        </div>
        <div class="pending-user-details">
          <p><strong>Division:</strong> ${escapeHtml(user.division)}</p>
          <p><strong>Branch:</strong> ${escapeHtml(user.branch)}</p>
          <p><strong>Year:</strong> ${escapeHtml(user.year)}</p>
          <p><strong>Submitted:</strong> ${new Date(user.submittedAt).toLocaleDateString()}</p>
        </div>
        <div class="pending-user-id-card">
          <p><strong>ID Card:</strong></p>
          <img src="${user.idCard}" alt="ID Card" onclick="viewIdCard('${user.id}')" />
        </div>
      </div>
      <div class="pending-user-actions">
        <button class="btn btn-approve" onclick="approveUser('${user.id}')">
          <i class="fa-solid fa-check"></i> Approve
        </button>
        <button class="btn btn-reject" onclick="rejectUser('${user.id}')">
          <i class="fa-solid fa-xmark"></i> Reject
        </button>
      </div>
    </div>
  `).join('');
}

function viewIdCard(userId) {
  const user = pendingUsers.find(u => u.id === userId);
  if (user && user.idCard) {
    const modal = document.createElement('div');
    modal.className = 'id-card-modal';
    modal.innerHTML = `
      <div class="id-card-modal-content">
        <button class="id-card-close" onclick="this.parentElement.parentElement.remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <img src="${user.idCard}" alt="ID Card" />
        <p>${escapeHtml(user.name)}</p>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}

async function approveUser(userId) {
  if (!confirm('Approve this user registration?')) return;
  
  try {
    const user = pendingUsers.find(u => u.id === userId);
    if (user) {
      const approvedRef = window.firebaseRef(window.firebaseDB, `approved-users/${userId}`);
      await window.firebaseSet(approvedRef, {
        name: user.name,
        division: user.division,
        branch: user.branch,
        year: user.year,
        idCard: user.idCard,
        submittedAt: user.submittedAt,
        approvedAt: new Date().toISOString()
      });
    }
    
    const userRef = window.firebaseRef(window.firebaseDB, `pending-users/${userId}`);
    await window.firebaseUpdate(userRef, { status: 'approved' });
    
    showToast('User approved successfully!');
  } catch (error) {
    console.error('Error approving user:', error);
    showToast('Failed to approve user');
  }
}

async function rejectUser(userId) {
  if (!confirm('Reject this user registration?')) return;
  
  try {
    const userRef = window.firebaseRef(window.firebaseDB, `pending-users/${userId}`);
    await window.firebaseUpdate(userRef, { status: 'rejected' });
    showToast('User registration rejected');
  } catch (error) {
    console.error('Error rejecting user:', error);
    showToast('Failed to reject user');
  }
}

window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.switchAdminTab = switchAdminTab;
window.handleUpload = handleUpload;
window.deleteBook = deleteBook;
window.migrateOldBooks = migrateOldBooks;
window.toggleDesktopAccess = toggleDesktopAccess;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.viewIdCard = viewIdCard;

initFirebase();
