// js/dashboard.js

const AUTH_KEY = 'urochithi_dashboard_auth';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let messages = [];
let filteredMessages = [];
let lastActivity = Date.now();
let staticPinValue = '';
let currentLetter = null;

// Load site URL from config.js (falls back to current origin)
const AppConfig = (window.UROCHITHI_CONFIG && window.UROCHITHI_CONFIG.CONFIG) || {};
const SITE_URL = AppConfig.siteUrl || window.location.origin;

// Update UTC time display
function updateUTCTime() {
  const now = new Date();
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const timeEl = document.getElementById('utcTime');
  if (timeEl) timeEl.textContent = `${hours}:${minutes}`;
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// Check if already authenticated
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

// Activity tracking for auto-logout
document.addEventListener('click', () => lastActivity = Date.now());
document.addEventListener('keypress', () => lastActivity = Date.now());
setInterval(() => {
  if (Date.now() - lastActivity > SESSION_TIMEOUT) logout();
}, 60000);

// Step 1: Static PIN
document.getElementById('step1Form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const staticPin = document.getElementById('staticPin').value;
  const errorDiv = document.getElementById('step1Error');
  const button = document.getElementById('step1Button');

  errorDiv.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Verifying...';

  try {
    const response = await fetch('/.netlify/functions/verify-static-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staticPin })
    });
    const data = await response.json();

    if (response.ok && data.valid) {
      staticPinValue = staticPin;
      document.getElementById('step1Container').style.display = 'none';
      document.getElementById('step2Container').style.display = 'block';
    } else {
      errorDiv.textContent = data.error || 'Invalid PIN';
      errorDiv.classList.add('show');
    }
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
    errorDiv.classList.add('show');
  } finally {
    button.disabled = false;
    button.textContent = 'Continue';
  }
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
  const timePin = document.getElementById('timePin').value;
  const errorDiv = document.getElementById('step2Error');
  const button = document.getElementById('step2Button');

  errorDiv.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Authenticating...';

  try {
    const response = await fetch('/.netlify/functions/verify-time-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staticPin: staticPinValue, timePin })
    });
    const data = await response.json();

    if (response.ok && data.authenticated) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({
        authenticated: true,
        timestamp: Date.now()
      }));
      showDashboard();
      loadMessages();
    } else {
      errorDiv.textContent = data.error || 'Invalid code';
      errorDiv.classList.add('show');
    }
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
    errorDiv.classList.add('show');
  } finally {
    button.disabled = false;
    button.textContent = 'Authenticate';
  }
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

// Load messages from server
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

// Update stats cards
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

// Filter and sort messages
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

// Display messages in table
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

  // Attach click handlers to View buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'));
      openLetter(idx);
    });
  });
}

// Open letter modal
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
    alert('Copy failed');
  }
});

// Save as Image – Full long letter + gridlines preserved
document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!currentLetter) return;

  const card = document.getElementById('letterCard');
  const wrapper = document.querySelector('.letter-content-wrapper');

  // Backup original styles
  const origWrapperStyle = wrapper.style.cssText;
  const origCardStyle = card.style.cssText;
  const origBodyOverflow = document.body.style.overflow;

  // Prepare for full capture
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
    // Restore original state
    card.classList.remove('capture-mode');
    wrapper.style.cssText = origWrapperStyle;
    card.style.cssText = origCardStyle;
    document.body.style.overflow = origBodyOverflow;
  }
});

// Share button – Beautiful on-brand modal
document.getElementById('shareBtn').addEventListener('click', async () => {
  if (!currentLetter) return;

  const excerpt = currentLetter.message.length > 150
    ? currentLetter.message.substring(0, 150) + '...'
    : currentLetter.message;

  const shareText = `📮 Anonymous Letter from Urochithi\n\n"${excerpt}"\n\nCreate your own: ${SITE_URL}`;

  // Native share if available
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Urochithi Anonymous Letter',
        text: shareText,
        url: SITE_URL
      });
      return;
    } catch (err) {
      // Ignore if user cancels
    }
  }

  // Custom beautiful share modal
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

  // Close handlers
  document.getElementById('closeShareModal').addEventListener('click', () => {
    document.getElementById('customShareModal').remove();
  });

  document.getElementById('customShareModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('customShareModal')) {
      document.getElementById('customShareModal').remove();
    }
  });

  // Copy button feedback
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

// Helper: format timestamp
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper: escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners for filters and refresh
document.getElementById('searchInput').addEventListener('input', filterAndDisplayMessages);
document.getElementById('sortSelect').addEventListener('change', filterAndDisplayMessages);
document.getElementById('filterSelect').addEventListener('change', filterAndDisplayMessages);
document.getElementById('refreshBtn').addEventListener('click', loadMessages);

// Initial auth check
checkAuth();