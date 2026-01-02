const ADMIN_USERNAME = 'atharva_phatangare';
const ADMIN_PASSWORD = 'atharva@1408';

let isLoggedIn = false;
let books = [];
let pendingUsers = [];
let approvedUsers = [];
let filteredApprovedUsers = [];
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

    onValue(ref(db, 'approved-users'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        approvedUsers = Object.entries(data).map(([id, user]) => ({
          id,
          ...user
        }));
      } else {
        approvedUsers = [];
      }
      filteredApprovedUsers = [...approvedUsers];
      renderApprovedUsers();
    });
    
    checkAdminSession();
    
    // Load EmailJS config into settings tab if it exists
    onValue(ref(db, 'settings/emailjs'), (snapshot) => {
      if (snapshot.exists()) {
        const config = snapshot.val();
        const serviceIdInput = document.getElementById('emailjs-service-id');
        const templateIdInput = document.getElementById('emailjs-template-id');
        const publicKeyInput = document.getElementById('emailjs-public-key');
        
        if (serviceIdInput) serviceIdInput.value = config.serviceId || '';
        if (templateIdInput) templateIdInput.value = config.templateId || '';
        if (publicKeyInput) publicKeyInput.value = config.publicKey || '';
      }
    });
    
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
  
  const tabBtn = document.getElementById(`tab-${tabName}`);
  const tabContent = document.getElementById(`admin-tab-${tabName}`);
  
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');
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
  const pages = document.getElementById('book-pages').value.trim();
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
    
    await addBook(title, author, pages, description, coverData, bookData, bookFile.name);
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

async function addBook(title, author, pages, description, cover, fileData, fileName) {
  const metaRef = window.firebaseRef(window.firebaseDB, 'book-meta');
  const newBookRef = window.firebasePush(metaRef);
  const bookId = newBookRef.key;
  
  const bookMeta = {
    title,
    author,
    pages,
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
        updates['book-meta/' + id] = {
          title: book.title,
          author: book.author,
          description: book.description,
          cover: book.cover,
          fileName: book.fileName,
          createdAt: book.createdAt
        };
        updates['book-files/' + id] = book.fileData;
        updates['books/' + id] = null;
        
        await window.firebaseUpdate(window.firebaseRef(window.firebaseDB), updates);
        migrated++;
      } catch (error) {
        console.error('Failed to migrate book ' + id + ':', error);
        failed++;
      }
    }
    
    migrateBtn.disabled = false;
    migrateBtn.textContent = 'Migrate';
    
    if (failed === 0) {
      showToast('Successfully migrated ' + migrated + ' book(s)!');
      document.getElementById('migration-card').classList.add('hidden');
    } else {
      showToast('Migrated ' + migrated + ', failed ' + failed);
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
          <p><strong>Email:</strong> ${escapeHtml(user.email || 'N/A')}</p>
          <p><strong>Phone:</strong> ${escapeHtml(user.phone || 'N/A')}</p>
          <p><strong>College:</strong> ${escapeHtml(user.college || 'N/A')}</p>
          <p><strong>Division:</strong> ${escapeHtml(user.division)}</p>
          <p><strong>Branch:</strong> ${escapeHtml(user.branch)}</p>
          <p><strong>Year:</strong> ${escapeHtml(user.year)}</p>
          <p><strong>Submitted:</strong> ${new Date(user.submittedAt).toLocaleDateString()}</p>
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

function renderApprovedUsers() {
  const list = document.getElementById('approved-users-list');
  const empty = document.getElementById('approved-users-empty');
  
  if (!list || !empty) return;
  
  if (filteredApprovedUsers.length === 0) {
    list.innerHTML = '';
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  list.classList.remove('hidden');
  
  list.innerHTML = filteredApprovedUsers.map(user => `
    <div class="pending-user-card">
      <div class="pending-user-info">
        <div class="pending-user-header">
          <h4>${escapeHtml(user.name)}</h4>
          <span class="pending-badge" style="background: #dcfce7; color: #166534;">Approved</span>
        </div>
        <div class="pending-user-details">
          <p><strong>Email:</strong> ${escapeHtml(user.email || 'N/A')}</p>
          <p><strong>Phone:</strong> ${escapeHtml(user.phone || 'N/A')}</p>
          <p><strong>College:</strong> ${escapeHtml(user.college || 'N/A')}</p>
          <p><strong>Approved:</strong> ${new Date(user.approvedAt).toLocaleDateString()}</p>
          <p><strong>User ID:</strong> <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${user.credentials ? user.credentials.id : 'N/A'}</code></p>
          <p><strong>Password:</strong> <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${user.credentials ? user.credentials.password : 'N/A'}</code></p>
        </div>
      </div>
      <div class="pending-user-actions">
        <button class="btn btn-approve" onclick="showCredentialsModal('${user.credentials?.id}', '${user.credentials?.password}', '${escapeHtml(user.name)}', '${escapeHtml(user.email)}')" style="flex: 1;">
          <i class="fa-solid fa-key"></i> Credentials
        </button>
        <button class="btn btn-reject" onclick="revokeUser('${user.id}')" style="flex: 1;">
          <i class="fa-solid fa-trash"></i> Revoke
        </button>
      </div>
    </div>
  `).join('');
}

function handleUserSearch() {
  const query = document.getElementById('user-search-input').value.toLowerCase().trim();
  if (!query) {
    filteredApprovedUsers = [...approvedUsers];
  } else {
    filteredApprovedUsers = approvedUsers.filter(user => 
      (user.name && user.name.toLowerCase().includes(query)) || 
      (user.email && user.email.toLowerCase().includes(query))
    );
  }
  renderApprovedUsers();
}

function viewIdCard(userId, type = 'pending') {
  const users = type === 'pending' ? pendingUsers : approvedUsers;
  const user = users.find(u => u.id === userId);
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

function generateRandomId(name) {
  const adjectives = ['cool', 'smart', 'fast', 'bright', 'happy', 'kind', 'brave', 'calm', 'keen', 'bold'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const cleanName = name.toLowerCase().replace(/[^a-z]/g, '').substring(0, 6);
  const num = Math.floor(100 + Math.random() * 899);
  return `${adj}_${cleanName}${num}`;
}

function generateRandomPassword(length = 12) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

function showCredentialsModal(id, password, name, email) {
  const modal = document.createElement('div');
  modal.className = 'id-card-modal';
  modal.innerHTML = `
    <div class="id-card-modal-content credential-modal">
      <button class="id-card-close" onclick="this.closest('.id-card-modal').remove()">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="credential-header">
        <i class="fa-solid fa-key"></i>
        <h3>User Credentials Generated</h3>
      </div>
      <p class="credential-subtitle">Credentials for <strong>${escapeHtml(name)}</strong></p>
      
      <div class="credential-field">
        <label>User ID</label>
        <div class="credential-value-wrap">
          <span class="credential-value">${id}</span>
          <button class="copy-btn" onclick="copyToClipboard('${id}', this)">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
      </div>
      
      <div class="credential-field">
        <label>Password</label>
        <div class="credential-value-wrap">
          <span class="credential-value">${password}</span>
          <button class="copy-btn" onclick="copyToClipboard('${password}', this)">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
      </div>
      
      <div class="credential-actions">
        <button id="send-credentials-btn" class="btn btn-primary btn-full" onclick="sendCredentialsEmail('${id}', '${password}', '${escapeHtml(name)}', '${escapeHtml(email)}', this)">
          <i class="fa-solid fa-paper-plane"></i> Send Credentials
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function sendCredentialsEmail(id, password, name, email, btn) {
  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

  try {
    const settingsRef = window.firebaseRef(window.firebaseDB, 'settings/emailjs');
    const snapshot = await window.firebaseGet(settingsRef);
    
    if (!snapshot.exists()) {
      showToast('EmailJS credentials not found in RTDB');
      btn.disabled = false;
      btn.innerHTML = originalContent;
      return;
    }

    const config = snapshot.val();
    
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: {
          to_name: name,
          to_email: email,
          user_id: id,
          user_password: password
        }
      })
    });

    if (response.ok) {
      showToast('Credentials sent to ' + email);
      btn.closest('.id-card-modal').remove();
    } else {
      const err = await response.text();
      console.error('EmailJS error:', err);
      showToast('Failed to send email');
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  } catch (error) {
    console.error('Email error:', error);
    showToast('An error occurred while sending email');
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

window.sendCredentialsEmail = sendCredentialsEmail;

async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    btn.classList.add('copied');
    showToast('Copied to clipboard');
    setTimeout(() => {
      btn.innerHTML = originalContent;
      btn.classList.remove('copied');
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    showToast('Failed to copy');
  }
}

window.copyToClipboard = copyToClipboard;

async function approveUser(userId) {
  if (!confirm('Approve this user registration?')) return;
  
  try {
    const user = pendingUsers.find(u => u.id === userId);
    if (user) {
      const generatedId = generateRandomId(user.name);
      const generatedPassword = generateRandomPassword(12);

      // 1. Save email-to-device binding to prevent same email on other device
      const emailKey = user.email.toLowerCase().replace(/[.#$[\]]/g, '_');
      const emailBindingRef = window.firebaseRef(window.firebaseDB, 'email-bindings/' + emailKey);
      await window.firebaseSet(emailBindingRef, {
        deviceId: userId,
        email: user.email,
        approvedAt: new Date().toISOString()
      });

      // 2. Save device-to-email binding to prevent same device with other email
      const deviceBindingRef = window.firebaseRef(window.firebaseDB, 'device-bindings/' + userId);
      await window.firebaseSet(deviceBindingRef, {
        email: user.email,
        name: user.name,
        approvedAt: new Date().toISOString()
      });

      const approvedRef = window.firebaseRef(window.firebaseDB, 'approved-users/' + userId);
      await window.firebaseSet(approvedRef, {
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        college: user.college || '',
        submittedAt: user.submittedAt,
        approvedAt: new Date().toISOString(),
        deviceId: userId,
        credentials: {
          id: generatedId,
          password: generatedPassword
        }
      });

      const userRef = window.firebaseRef(window.firebaseDB, 'pending-users/' + userId);
      await window.firebaseRemove(userRef);
      
      showToast('User approved successfully!');
      showCredentialsModal(generatedId, generatedPassword, user.name, user.email);
    }
  } catch (error) {
    console.error('Error approving user:', error);
    showToast('Failed to approve user');
  }
}

async function rejectUser(userId) {
  if (!confirm('Reject this user registration?')) return;
  
  try {
    const userRef = window.firebaseRef(window.firebaseDB, 'pending-users/' + userId);
    await window.firebaseUpdate(userRef, { status: 'rejected' });
    showToast('User registration rejected');
  } catch (error) {
    console.error('Error rejecting user:', error);
    showToast('Failed to reject user');
  }
}

async function revokeUser(userId) {
  if (!confirm('Revoke access for this user? This will also remove their device binding.')) return;
  
  try {
    const user = approvedUsers.find(u => u.id === userId);
    if (user) {
      const emailKey = user.email.toLowerCase().replace(/[.#$[\]]/g, '_');
      await window.firebaseRemove(window.firebaseRef(window.firebaseDB, 'email-bindings/' + emailKey));
      await window.firebaseRemove(window.firebaseRef(window.firebaseDB, 'device-bindings/' + userId));
      await window.firebaseRemove(window.firebaseRef(window.firebaseDB, 'approved-users/' + userId));
      
      const userRef = window.firebaseRef(window.firebaseDB, 'pending-users/' + userId);
      await window.firebaseRemove(userRef);
      
      showToast('User access revoked and all records removed');
    }
  } catch (error) {
    console.error('Error revoking user:', error);
    showToast('Failed to revoke access');
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
window.revokeUser = revokeUser;
window.viewIdCard = viewIdCard;
window.handleUserSearch = handleUserSearch;
window.showCredentialsModal = showCredentialsModal;
window.copyToClipboard = copyToClipboard;

async function saveEmailJSConfig(e) {
  e.preventDefault();
  
  const serviceId = document.getElementById('emailjs-service-id').value.trim();
  const templateId = document.getElementById('emailjs-template-id').value.trim();
  const publicKey = document.getElementById('emailjs-public-key').value.trim();
  
  try {
    const settingsRef = window.firebaseRef(window.firebaseDB, 'settings/emailjs');
    await window.firebaseSet(settingsRef, {
      serviceId,
      templateId,
      publicKey,
      updatedAt: new Date().toISOString()
    });
    showToast('EmailJS configuration saved successfully!');
  } catch (error) {
    console.error('Error saving EmailJS config:', error);
    showToast('Failed to save configuration');
  }
}

window.saveEmailJSConfig = saveEmailJSConfig;

// Initialize security measures
function initSecurity() {
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
}

initSecurity();
initFirebase();
