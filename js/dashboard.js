// js/dashboard.js

const AUTH_KEY = 'urochithi_dashboard_auth';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let messages = [];
let filteredMessages = [];
let lastActivity = Date.now();
let staticPinValue = '';
let currentLetter = null;

// reCAPTCHA Site Key pulled from Netlify environment variable (set in Netlify dashboard)
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || 'YOUR_FALLBACK_SITE_KEY_IF_NEEDED';

const AppConfig = (window.UROCHITHI_CONFIG && window.UROCHITHI_CONFIG.CONFIG) || {};
const SITE_URL = AppConfig.siteUrl || window.location.origin;

// === BRUTE FORCE PROTECTION (client-side) ===
let loginAttempts = parseInt(localStorage.getItem('urochithi_login_attempts') || '0');
let lockoutUntil = parseInt(localStorage.getItem('urochithi_lockout_until') || '0');

function isLockedOut() {
  if (lockoutUntil > Date.now()) {
    const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
    return { locked: true, minutes: minutesLeft };
  }
  return { locked: false };
}

function recordFailedAttempt() {
  loginAttempts++;
  localStorage.setItem('urochithi_login_attempts', loginAttempts);
  if (loginAttempts >= 5) {
    lockoutUntil = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
    localStorage.setItem('urochithi_lockout_until', lockoutUntil);
    loginAttempts = 0;
    localStorage.setItem('urochithi_login_attempts', '0');
  }
}

function resetLoginAttempts() {
  loginAttempts = 0;
  lockoutUntil = 0;
  localStorage.removeItem('urochithi_login_attempts');
  localStorage.removeItem('urochithi_lockout_until');
}

function showAuthError(errorDiv, message) {
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
}

// UTC Time Display
function updateUTCTime() {
  const now = new Date();
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const timeEl = document.getElementById('utcTime');
  if (timeEl) timeEl.textContent = `${hours}:${minutes}`;
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// Initial Auth Check
function checkAuth() {
  const auth = localStorage.getItem(AUTH_KEY);
  if (auth) {
    const authData = JSON.parse(auth);
    const now = Date.now();
    if (now - authData.timestamp < SESSION_TIMEOUT) {
      lastActivity = now;
      showDashboard();
      loadMessages();
      return true;
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }
  return false;
}

// Activity tracking for session timeout
document.addEventListener('click', () => lastActivity = Date.now());
document.addEventListener('keypress', () => lastActivity = Date.now());
setInterval(() => {
  if (Date.now() - lastActivity > SESSION_TIMEOUT) logout();
}, 60000);

// Step 1: Static PIN
document.getElementById('step1Form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const lockout = isLockedOut();
  if (lockout.locked) {
    showAuthError(document.getElementById('step1Error'), `Too many attempts. Try again in ${lockout.minutes} minute${lockout.minutes > 1 ? 's' : ''}.`);
    return;
  }

  const staticPin = document.getElementById('staticPin').value.trim();
  const errorDiv = document.getElementById('step1Error');
  const button = document.getElementById('step1Button');

  if (!staticPin) return;

  errorDiv.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Verifying...';

  grecaptcha.ready(async () => {
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login_step1' });

      const response = await fetch('/.netlify/functions/verify-static-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staticPin, recaptchaToken: token })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        staticPinValue = staticPin;
        resetLoginAttempts();
        document.getElementById('step1Container').style.display = 'none';
        document.getElementById('step2Container').style.display = 'block';
      } else {
        recordFailedAttempt();
        const remaining = 5 - loginAttempts;
        showAuthError(errorDiv, remaining > 0
          ? 'Invalid credentials'
          : 'Too many failed attempts. Account locked for 15 minutes.');
      }
    } catch (error) {
      recordFailedAttempt();
      showAuthError(errorDiv, 'Network error. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = 'Continue';
    }
  });
});

document.getElementById('backToStep1').addEventListener('click', () => {
  document.getElementById('step2Container').style.display = 'none';
  document.getElementById('step1Container').style.display = 'block';
  document.getElementById('staticPin').value = '';
  staticPinValue = '';
});

// Step 2: Time-based PIN
document.getElementById('step2Form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const lockout = isLockedOut();
  if (lockout.locked) {
    showAuthError(document.getElementById('step2Error'), `Too many attempts. Try again in ${lockout.minutes} minute${lockout.minutes > 1 ? 's' : ''}.`);
    return;
  }

  const timePin = document.getElementById('timePin').value.trim();
  const errorDiv = document.getElementById('step2Error');
  const button = document.getElementById('step2Button');

  if (!timePin) return;

  errorDiv.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Authenticating...';

  grecaptcha.ready(async () => {
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login_step2' });

      const response = await fetch('/.netlify/functions/verify-time-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staticPin: staticPinValue, timePin, recaptchaToken: token })
      });

      const data = await response.json();

      if (response.ok && data.authenticated) {
        localStorage.setItem(AUTH_KEY, JSON.stringify({
          authenticated: true,
          timestamp: Date.now()
        }));
        resetLoginAttempts();
        showDashboard();
        loadMessages();
      } else {
        recordFailedAttempt();
        const remaining = 5 - loginAttempts;
        showAuthError(errorDiv, remaining > 0
          ? 'Invalid credentials'
          : 'Too many failed attempts. Account locked for 15 minutes.');
      }
    } catch (error) {
      recordFailedAttempt();
      showAuthError(errorDiv, 'Network error. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = 'Authenticate';
    }
  });
});

function showDashboard() {
  document.getElementById('step1Container').style.display = 'none';
  document.getElementById('step2Container').style.display = 'none';
  document.getElementById('dashboardContainer').classList.add('show');
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  location.reload();
}
document.getElementById('logoutBtn').addEventListener('click', logout);

// Load messages
async function loadMessages() {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = `
    <div class="loading-screen">
      <div class="spinner"></div>
      <div class="loading-text">Loading messages...</div>
    </div>`;

  try {
    const response = await fetch('/.netlify/functions/get-messages', {
      headers: {
        'Authorization': JSON.stringify(JSON.parse(localStorage.getItem(AUTH_KEY)))
      }
    });

    if (!response.ok) throw new Error('Failed to load');
    const data = await response.json();
    messages = data.messages || [];
    updateStats();
    filterAndDisplayMessages();
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">Error loading messages. Please refresh.</div>
      </div>`;
  }
}

// Update stats
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

// Filter & sort
function filterAndDisplayMessages() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const sortBy = document.getElementById('sortSelect').value;
  const filterBy = document.getElementById('filterSelect').value;

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

  filteredMessages.sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  displayMessages();
}

// Display table
function displayMessages() {
  const container = document.getElementById('messagesContainer');

  if (filteredMessages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No messages found.</div>
      </div>`;
    return;
  }

  const table = `
    <table class="messages-table">
      <thead>
        <tr>
          <th style="width: 160px">Timestamp</th>
          <th>Preview</th>
          <th style="width: 180px">Session ID</th>
          <th style="width: 100px">Action</th>
        </tr>
      </thead>
      <tbody>
        ${filteredMessages.map((msg, idx) => `
          <tr>
            <td class="timestamp">${formatDate(msg.timestamp)}</td>
            <td><div class="message-preview">${escapeHtml(msg.message)}</div></td>
            <td><span class="session-id">${msg.sessionId}</span></td>
            <td><button class="view-btn" data-index="${idx}">View</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

  container.innerHTML = table;

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'));
      openLetter(idx);
    });
  });
}

// Modal functions
function openLetter(index) {
  currentLetter = filteredMessages[index];
  document.getElementById('modalLetterContent').innerHTML =
    currentLetter.message.replace(/\n/g, '<br>');
  document.getElementById('modalSessionId').textContent = `Session: ${currentLetter.sessionId}`;
  document.getElementById('domainText').textContent = SITE_URL.replace(/^https?:\/\//, '');
  document.getElementById('letterModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeLetter() {
  document.getElementById('letterModal').classList.remove('show');
  document.body.style.overflow = '';
  currentLetter = null;
}

document.getElementById('closeModal').addEventListener('click', closeLetter);
document.getElementById('letterModal').addEventListener('click', (e) => {
  if (e.target.id === 'letterModal') closeLetter();
});

// Copy
document.getElementById('copyBtn').addEventListener('click', async () => {
  if (!currentLetter) return;
  try {
    await navigator.clipboard.writeText(currentLetter.message);
    const btn = document.getElementById('copyBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<span>✓</span> <span>Copied!</span>';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  } catch (err) {
    alert('Copy failed');
  }
});

// Save as Image
document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!currentLetter) return;

  const card = document.getElementById('letterCard');
  const wrapper = document.querySelector('.letter-content-wrapper');

  const origWrapperStyle = wrapper.style.cssText;
  const origCardStyle = card.style.cssText;
  const origBodyOverflow = document.body.style.overflow;

  card.classList.add('capture-mode');
  wrapper.style.overflow = 'visible';
  wrapper.style.maxHeight = 'none';
  wrapper.style.height = 'auto';
  card.style.maxHeight = 'none';
  card.style.height = 'auto';
  document.body.style.overflow = 'visible';

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
    console.error('Save error:', err);
    alert('Failed to save image. Please try again.');
  } finally {
    card.classList.remove('capture-mode');
    wrapper.style.cssText = origWrapperStyle;
    card.style.cssText = origCardStyle;
    document.body.style.overflow = origBodyOverflow;
  }
});

// Share – Beautiful on-brand modal
document.getElementById('shareBtn').addEventListener('click', async () => {
  if (!currentLetter) return;

  const excerpt = currentLetter.message.length > 150
    ? currentLetter.message.substring(0, 150) + '...'
    : currentLetter.message;

  const shareText = `📮 Anonymous Letter from Urochithi\n\n"${excerpt}"\n\nCreate your own: ${SITE_URL}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Urochithi Anonymous Letter',
        text: shareText,
        url: SITE_URL
      });
      return;
    } catch (err) {}
  }

  const modalHtml = `
    <div class="share-modal-overlay" id="customShareModal">
      <div class="share-modal-paper">
        <div class="stain stain1"></div>
        <div class="stain stain2"></div>
        <div class="stain stain3"></div>

        <button class="close-modal" id="closeShareModal">×</button>

        <div class="share-header">
          <div class="letter-title">Share This Letter</div>
          <div class="letter-subtitle">Choose a platform</div>
        </div>

        <div class="share-options">
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}" target="_blank" class="share-btn twitter">
            <span>𝕏</span> <span>Twitter / X</span>
          </a>
          <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}" target="_blank" class="share-btn whatsapp">
            <span>💬</span> <span>WhatsApp</span>
          </a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}&quote=${encodeURIComponent(excerpt)}" target="_blank" class="share-btn facebook">
            <span>📘</span> <span>Facebook</span>
          </a>
          <a href="https://t.me/share/url?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(shareText)}" target="_blank" class="share-btn telegram">
            <span>✈️</span> <span>Telegram</span>
          </a>
          <button id="copyShareText" class="share-btn copy">
            <span>📋</span> <span>Copy Text</span>
          </button>
        </div>

        <div class="share-footer">
          Shared with love from <strong>Urochithi</strong>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('closeShareModal').addEventListener('click', () => {
    document.getElementById('customShareModal').remove();
  });

  document.getElementById('customShareModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('customShareModal')) {
      document.getElementById('customShareModal').remove();
    }
  });

  document.getElementById('copyShareText').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      const btn = document.getElementById('copyShareText');
      const orig = btn.innerHTML;
      btn.innerHTML = '<span>✓</span> <span>Copied!</span>';
      btn.style.background = '#e8f5e9';
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.style.background = '';
      }, 2000);
    } catch (err) {
      alert('Copy failed');
    }
  });
});

// Helpers
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Filters & refresh
document.getElementById('searchInput').addEventListener('input', filterAndDisplayMessages);
document.getElementById('sortSelect').addEventListener('change', filterAndDisplayMessages);
document.getElementById('filterSelect').addEventListener('change', filterAndDisplayMessages);
document.getElementById('refreshBtn').addEventListener('click', loadMessages);

// Start
checkAuth();