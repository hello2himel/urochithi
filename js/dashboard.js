// ============================================
// UROCHITHI DASHBOARD - NEON AUTH + NEON DB
// ============================================

const SESSION_KEY = 'urochithi_session';
let accessToken = null;
let userProfile = null;
let currentUsername = null;
let messages = [];
let filteredMessages = [];
let currentLetter = null;

// Load site URL from config
const AppConfig = (window.UROCHITHI_CONFIG && window.UROCHITHI_CONFIG.CONFIG) || {};
const SITE_URL = AppConfig.siteUrl || window.location.origin;
const NEON_AUTH_URL = AppConfig.neonAuthUrl;

// ============================================
// NEON AUTH - SESSION MANAGEMENT
// ============================================
async function initAuth() {
  // Check for existing session
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      accessToken = data.token;
      userProfile = data.user;
      // Verify token is still valid
      const valid = await verifySession();
      if (valid) {
        await checkUserRegistration();
        return;
      }
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
    }
  }
  showLoginScreen();
}

async function verifySession() {
  if (!NEON_AUTH_URL || NEON_AUTH_URL === 'YOUR_NEON_AUTH_URL') return false;
  try {
    const response = await fetch(`${NEON_AUTH_URL}/api/auth/get-session`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data.session || !data.user) return false;
    userProfile = data.user;
    return true;
  } catch (e) {
    return false;
  }
}

async function signIn(email, password) {
  if (!NEON_AUTH_URL || NEON_AUTH_URL === 'YOUR_NEON_AUTH_URL') {
    throw new Error('Authentication is not configured. Please set the Neon Auth URL.');
  }
  const response = await fetch(`${NEON_AUTH_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error('Invalid response from auth server. Please try again.');
  }
  if (!response.ok) throw new Error(data.message || 'Invalid email or password');
  accessToken = data.session?.token || data.token;
  userProfile = data.user;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: accessToken, user: userProfile }));
  return data;
}

async function signUp(name, email, password) {
  if (!NEON_AUTH_URL || NEON_AUTH_URL === 'YOUR_NEON_AUTH_URL') {
    throw new Error('Authentication is not configured. Please set the Neon Auth URL.');
  }
  const response = await fetch(`${NEON_AUTH_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error('Invalid response from auth server. Please try again.');
  }
  if (!response.ok) throw new Error(data.message || 'Sign up failed');
  accessToken = data.session?.token || data.token;
  userProfile = data.user;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: accessToken, user: userProfile }));
  return data;
}

// ============================================
// LOGIN / LOGOUT UI
// ============================================
function showLoginScreen() {
  document.getElementById('loginContainer').style.display = '';
  document.getElementById('registerContainer').style.display = 'none';
  document.getElementById('dashboardContainer').classList.remove('show');
}

async function logout() {
  try {
    await fetch(`${NEON_AUTH_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
  } catch (e) { /* ignore */ }
  localStorage.removeItem(SESSION_KEY);
  accessToken = null;
  userProfile = null;
  currentUsername = null;
  showLoginScreen();
}

// ============================================
// SIGN IN / SIGN UP FORMS
// ============================================
document.getElementById('signInForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signInEmail').value;
  const password = document.getElementById('signInPassword').value;
  const errorDiv = document.getElementById('signInError');
  const button = document.getElementById('signInButton');

  errorDiv.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Signing in...';

  try {
    await signIn(email, password);
    await checkUserRegistration();
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.add('show');
  } finally {
    button.disabled = false;
    button.textContent = 'Sign In';
  }
});

document.getElementById('signUpForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signUpName').value;
  const email = document.getElementById('signUpEmail').value;
  const password = document.getElementById('signUpPassword').value;
  const errorDiv = document.getElementById('signUpError');
  const button = document.getElementById('signUpButton');

  errorDiv.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Creating account...';

  try {
    await signUp(name, email, password);
    await checkUserRegistration();
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.add('show');
  } finally {
    button.disabled = false;
    button.textContent = 'Sign Up';
  }
});

// Toggle sign in / sign up views
document.getElementById('showSignUp').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('signInView').style.display = 'none';
  document.getElementById('signUpView').style.display = '';
});
document.getElementById('showSignIn').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('signUpView').style.display = 'none';
  document.getElementById('signInView').style.display = '';
});

// ============================================
// USER REGISTRATION CHECK
// ============================================
async function checkUserRegistration() {
  try {
    const response = await fetch('/.netlify/functions/check-user', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json();

    if (data.registered) {
      currentUsername = data.username;
      showDashboard();
      loadMessages();
    } else {
      showRegistrationScreen();
    }
  } catch (error) {
    console.error('Check user error:', error);
    showRegistrationScreen();
  }
}

function showRegistrationScreen() {
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('registerContainer').style.display = '';
  document.getElementById('dashboardContainer').classList.remove('show');

  // Pre-fill with name if available
  const input = document.getElementById('usernameInput');
  if (userProfile && userProfile.name) {
    input.value = userProfile.name.toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 30);
  }
}

async function registerUsername() {
  const input = document.getElementById('usernameInput');
  const errorDiv = document.getElementById('registerError');
  const button = document.getElementById('registerButton');
  const username = input.value.trim().toLowerCase();

  errorDiv.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Registering...';

  try {
    const response = await fetch('/.netlify/functions/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ username })
    });

    const data = await response.json();

    if (!response.ok) {
      errorDiv.textContent = data.error || 'Registration failed';
      errorDiv.classList.add('show');
      button.disabled = false;
      button.textContent = 'Claim Username';
      return;
    }

    currentUsername = data.username;
    showDashboard();
    loadMessages();
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
    errorDiv.classList.add('show');
    button.disabled = false;
    button.textContent = 'Claim Username';
  }
}

// ============================================
// DASHBOARD DISPLAY
// ============================================
function showDashboard() {
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('registerContainer').style.display = 'none';
  document.getElementById('dashboardContainer').classList.add('show');

  // Show username and share URL
  const shareUrl = `${SITE_URL}/${currentUsername}`;
  const shareUrlEl = document.getElementById('shareUrl');
  if (shareUrlEl) shareUrlEl.textContent = shareUrl;
  const shareUrlInput = document.getElementById('shareUrlInput');
  if (shareUrlInput) shareUrlInput.value = shareUrl;

  // Show user info
  const userInfoEl = document.getElementById('userDisplayName');
  if (userInfoEl && userProfile) {
    userInfoEl.textContent = userProfile.name || userProfile.email || currentUsername;
  }
}

// ============================================
// LOAD MESSAGES FROM SERVER
// ============================================
async function loadMessages() {
  const container = document.getElementById('lettersContainer');
  container.innerHTML = `
    <div class="loading-screen">
      <div class="spinner"></div>
      <div class="loading-text">Opening your letterbox...</div>
    </div>`;

  try {
    const response = await fetch('/.netlify/functions/get-messages', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();

    if (data.needsRegistration) {
      showRegistrationScreen();
      return;
    }

    messages = data.messages || [];
    updateStats();
    filterAndDisplayMessages();

  } catch (error) {
    container.innerHTML = `
      <div class="empty-letterbox">
        <div class="empty-icon"><i class="ri-inbox-line"></i></div>
        <div class="empty-title">Connection Error</div>
        <div class="empty-text">
          Unable to load your letters. Please check your connection and try again.
        </div>
      </div>`;
  }
}

// ============================================
// UPDATE STATS
// ============================================
function updateStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayCount = messages.filter(m => new Date(m.timestamp) >= today).length;
  const weekCount = messages.filter(m => new Date(m.timestamp) >= weekAgo).length;
  const uniqueSessions = new Set(messages.map(m => m.sessionId)).size;

  document.getElementById('totalMessages').textContent = messages.length;
  document.getElementById('todayMessages').textContent = todayCount;
  document.getElementById('uniqueSessions').textContent = uniqueSessions;
  document.getElementById('weekMessages').textContent = weekCount;
}

// ============================================
// FILTER AND DISPLAY MESSAGES
// ============================================
function filterAndDisplayMessages() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const sortBy = document.getElementById('sortSelect').value;
  const filterBy = document.getElementById('filterSelect').value;

  // Filter
  filteredMessages = messages.filter(msg => {
    if (searchTerm &&
        !msg.message.toLowerCase().includes(searchTerm) &&
        !msg.sessionId.toLowerCase().includes(searchTerm)) {
      return false;
    }

    const msgDate = new Date(msg.timestamp);
    const now = new Date();

    if (filterBy === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (msgDate < today) return false;
    } else if (filterBy === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (msgDate < weekAgo) return false;
    } else if (filterBy === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (msgDate < monthAgo) return false;
    }
    return true;
  });

  // Sort
  filteredMessages.sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  displayLetterCards();
}

// ============================================
// DISPLAY LETTERS AS CARDS
// ============================================
function displayLetterCards() {
  const container = document.getElementById('lettersContainer');

  if (filteredMessages.length === 0) {
    container.innerHTML = `
      <div class="empty-letterbox">
        <div class="empty-icon"><i class="ri-inbox-line"></i></div>
        <div class="empty-title">Your Letterbox is Empty</div>
        <div class="empty-text">
          ${messages.length === 0 
            ? 'No letters have arrived yet. Share your link to start receiving anonymous messages!' 
            : 'No letters match your search or filter.'}
        </div>
      </div>`;
    return;
  }

  const cardsHTML = filteredMessages.map((letter, index) => {
    const preview = letter.message.length > 120 
      ? letter.message.substring(0, 120) + '...' 
      : letter.message;
    
    const wordCount = letter.message.split(/\s+/).length;
    
    return `
      <div class="letter-card" data-index="${index}">
        <div class="letter-header">
          <div class="letter-meta">
            <div class="letter-date">${formatDate(letter.timestamp)}</div>
            <div class="letter-session">${escapeHtml(letter.sessionId)}</div>
          </div>
          <div class="letter-icon"><i class="ri-mail-line"></i></div>
        </div>
        <div class="letter-preview">${escapeHtml(preview)}</div>
        <div class="letter-footer">
          <div class="letter-length">${wordCount} words • ${letter.message.length} chars</div>
          <div class="read-btn">Read Letter →</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="letters-grid">${cardsHTML}</div>`;

  // Add click handlers
  document.querySelectorAll('.letter-card').forEach(card => {
    card.addEventListener('click', () => {
      const index = parseInt(card.getAttribute('data-index'));
      openLetterModal(index);
    });
  });
}

// ============================================
// OPEN LETTER MODAL
// ============================================
function openLetterModal(index) {
  currentLetter = filteredMessages[index];
  
  document.getElementById('modalLetterText').textContent = currentLetter.message;
  document.getElementById('modalSession').textContent = `Session: ${currentLetter.sessionId}`;
  document.getElementById('modalDomain').textContent = SITE_URL.replace(/^https?:\/\//, '');
  
  document.getElementById('letterModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeLetterModal() {
  document.getElementById('letterModal').classList.remove('show');
  document.body.style.overflow = '';
  currentLetter = null;
}

document.getElementById('closeModal').addEventListener('click', closeLetterModal);
document.getElementById('letterModal').addEventListener('click', (e) => {
  if (e.target.id === 'letterModal') closeLetterModal();
});

// ESC key to close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('letterModal').classList.contains('show')) {
    closeLetterModal();
  }
});

// ============================================
// MODAL ACTIONS
// ============================================

// Copy button
document.getElementById('copyBtn').addEventListener('click', async () => {
  if (!currentLetter) return;
  try {
    await navigator.clipboard.writeText(currentLetter.message);
    const btn = document.getElementById('copyBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<span>✓</span> <span>Copied!</span>';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  } catch (err) {
    alert('Copy failed. Please try again.');
  }
});

// Save as image button
document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!currentLetter) return;

  const card = document.getElementById('letterCard');
  const wrapper = card.querySelector('.modal-content');
  
  const origWrapperStyle = wrapper.style.cssText;
  const origCardStyle = card.style.cssText;

  card.classList.add('capture-mode');
  wrapper.style.overflow = 'visible';
  wrapper.style.maxHeight = 'none';
  card.style.maxHeight = 'none';

  try {
    const canvas = await html2canvas(card, {
      backgroundColor: '#faf8f3',
      scale: 2,
      useCORS: true,
      logging: false,
      height: card.scrollHeight,
      windowHeight: card.scrollHeight
    });

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urochithi-letter-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const btn = document.getElementById('saveBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<span>✓</span> <span>Saved!</span>';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
    
  } catch (err) {
    alert('Failed to save. Please try again.');
  } finally {
    card.classList.remove('capture-mode');
    wrapper.style.cssText = origWrapperStyle;
    card.style.cssText = origCardStyle;
  }
});

// Share button
document.getElementById('shareBtn').addEventListener('click', async () => {
  if (!currentLetter) return;

  const excerpt = currentLetter.message.length > 150
    ? currentLetter.message.substring(0, 150) + '...'
    : currentLetter.message;

  const shareText = `📮 Anonymous Letter from Urochithi\n\n"${excerpt}"\n\nCreate your own: ${SITE_URL}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Urochithi Letter',
        text: shareText,
        url: SITE_URL
      });
      return;
    } catch (err) {
      // Fallback to custom modal
    }
  }

  // Custom share modal
  const shareHTML = `
    <div class="share-modal-overlay" id="shareModal" style="
      position: fixed;
      inset: 0;
      background: rgba(93, 64, 55, 0.85);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 1.5rem;
    ">
      <div style="
        background: #faf8f3;
        background-image: linear-gradient(90deg, rgba(139, 69, 19, 0.05) 1px, transparent 1px), linear-gradient(rgba(139, 69, 19, 0.05) 1px, transparent 1px);
        background-size: 20px 20px;
        max-width: 480px;
        width: 100%;
        padding: 3rem 2.5rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        border-radius: 8px;
        text-align: center;
      ">
        <h2 style="font-size: 1.5rem; color: #5d4037; margin-bottom: 2rem; letter-spacing: 2px;">Share This Letter</h2>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem;">
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}" target="_blank" style="
            padding: 1rem 1.5rem;
            border: 2px solid #8d6e63;
            background: linear-gradient(145deg, #f8f6f0 0%, #f0ede5 100%);
            color: #5d4037;
            text-decoration: none;
            font-family: 'Special Elite', monospace;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            transition: all 0.3s ease;
          ">
            <span style="font-size: 1.5rem;">𝕏</span> <span>Share on Twitter</span>
          </a>
          <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}" target="_blank" style="
            padding: 1rem 1.5rem;
            border: 2px solid #8d6e63;
            background: linear-gradient(145deg, #f8f6f0 0%, #f0ede5 100%);
            color: #5d4037;
            text-decoration: none;
            font-family: 'Special Elite', monospace;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 1rem;
          ">
            <span style="font-size: 1.5rem;"><i class="ri-chat-3-line"></i></span> <span>Share on WhatsApp</span>
          </a>
          <button id="copyShareText" style="
            padding: 1rem 1.5rem;
            border: 2px solid #8d6e63;
            background: linear-gradient(145deg, #f8f6f0 0%, #f0ede5 100%);
            color: #5d4037;
            font-family: 'Special Elite', monospace;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: pointer;
          ">
            <span style="font-size: 1.5rem;"><i class="ri-clipboard-line"></i></span> <span>Copy Text</span>
          </button>
        </div>
        <button id="closeShareModal" style="
          padding: 0.75rem 2rem;
          border: 2px solid #8d6e63;
          background: transparent;
          color: #8d6e63;
          font-family: 'Special Elite', monospace;
          font-size: 0.85rem;
          cursor: pointer;
          letter-spacing: 1px;
        ">Close</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', shareHTML);

  document.getElementById('closeShareModal').addEventListener('click', () => {
    document.getElementById('shareModal').remove();
  });

  document.getElementById('copyShareText').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      const btn = document.getElementById('copyShareText');
      btn.innerHTML = '<span style="font-size: 1.5rem;">✓</span> <span>Copied!</span>';
      setTimeout(() => {
        document.getElementById('shareModal').remove();
      }, 1500);
    } catch (err) {
      alert('Copy failed');
    }
  });
});

// ============================================
// CSV IMPORT / EXPORT
// ============================================

async function exportCSV() {
  try {
    const response = await fetch('/.netlify/functions/export-csv', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `urochithi-${currentUsername}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert('Export failed. Please try again.');
  }
}

function showImportModal() {
  document.getElementById('importModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeImportModal() {
  document.getElementById('importModal').classList.remove('show');
  document.body.style.overflow = '';
  document.getElementById('csvFileInput').value = '';
  document.getElementById('importStatus').textContent = '';
  document.getElementById('importStatus').className = 'import-status';
}

async function handleCSVImport() {
  const fileInput = document.getElementById('csvFileInput');
  const statusDiv = document.getElementById('importStatus');
  const button = document.getElementById('importButton');

  if (!fileInput.files || fileInput.files.length === 0) {
    statusDiv.textContent = 'Please select a CSV file';
    statusDiv.className = 'import-status error';
    return;
  }

  const file = fileInput.files[0];
  if (!file.name.endsWith('.csv')) {
    statusDiv.textContent = 'Please select a .csv file';
    statusDiv.className = 'import-status error';
    return;
  }

  button.disabled = true;
  button.textContent = 'Importing...';
  statusDiv.textContent = 'Reading file...';
  statusDiv.className = 'import-status';

  try {
    const csv = await file.text();

    const response = await fetch('/.netlify/functions/import-csv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ csv })
    });

    const data = await response.json();

    if (!response.ok) {
      statusDiv.textContent = data.error || 'Import failed';
      statusDiv.className = 'import-status error';
      return;
    }

    statusDiv.textContent = `Successfully imported ${data.imported} messages (${data.skipped} skipped)`;
    statusDiv.className = 'import-status success';

    // Reload messages
    setTimeout(() => {
      closeImportModal();
      loadMessages();
    }, 2000);

  } catch (error) {
    statusDiv.textContent = 'Import failed: ' + error.message;
    statusDiv.className = 'import-status error';
  } finally {
    button.disabled = false;
    button.textContent = 'Import';
  }
}

// Copy share URL
function copyShareUrl() {
  const input = document.getElementById('shareUrlInput');
  if (input) {
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = document.getElementById('copyUrlBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '✓ Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }).catch(() => {
      input.select();
      document.execCommand('copy');
    });
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 172800000) return 'Yesterday';

  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  }) + ' at ' + date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// EVENT LISTENERS
// ============================================
document.getElementById('searchInput').addEventListener('input', filterAndDisplayMessages);
document.getElementById('sortSelect').addEventListener('change', filterAndDisplayMessages);
document.getElementById('filterSelect').addEventListener('change', filterAndDisplayMessages);
document.getElementById('refreshBtn').addEventListener('click', loadMessages);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  registerUsername();
});
document.getElementById('exportBtn').addEventListener('click', exportCSV);
document.getElementById('importBtn').addEventListener('click', showImportModal);
document.getElementById('closeImportModal').addEventListener('click', closeImportModal);
document.getElementById('importButton').addEventListener('click', handleCSVImport);
document.getElementById('copyUrlBtn').addEventListener('click', copyShareUrl);
document.getElementById('importModal').addEventListener('click', (e) => {
  if (e.target.id === 'importModal') closeImportModal();
});

// ============================================
// INITIALIZE
// ============================================
initAuth();