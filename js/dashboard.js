// ============================================
// UROCHITHI DASHBOARD - LETTERBOX UX
// ============================================

const AUTH_KEY = 'urochithi_dashboard_auth';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

let messages = [];
let filteredMessages = [];
let lastActivity = Date.now();
let staticPinValue = '';
let currentLetter = null;

// Load site URL from config
const AppConfig = (window.UROCHITHI_CONFIG && window.UROCHITHI_CONFIG.CONFIG) || {};
const SITE_URL = AppConfig.siteUrl || window.location.origin;

// ============================================
// RECAPTCHA V3 SETUP
// ============================================
(function loadRecaptcha() {
  const siteKey = AppConfig.recaptchaSiteKey;
  if (!siteKey || siteKey === 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
    console.warn('⚠️ reCAPTCHA not configured');
    return;
  }
  const script = document.createElement('script');
  script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
})();

async function executeRecaptcha(action) {
  const siteKey = AppConfig.recaptchaSiteKey;
  if (!siteKey || siteKey === 'YOUR_RECAPTCHA_SITE_KEY_HERE') {
    throw new Error('reCAPTCHA not configured');
  }
  if (!window.grecaptcha) {
    throw new Error('reCAPTCHA not loaded');
  }
  return await window.grecaptcha.execute(siteKey, { action });
}

// ============================================
// UTC TIME DISPLAY
// ============================================
function updateUTCTime() {
  const now = new Date();
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const timeEl = document.getElementById('utcTime');
  if (timeEl) timeEl.textContent = `${hours}:${minutes}`;
}
setInterval(updateUTCTime, 1000);
updateUTCTime();

// ============================================
// AUTH CHECK & SESSION MANAGEMENT
// ============================================
function checkAuth() {
  const auth = localStorage.getItem(AUTH_KEY);
  if (auth) {
    const authData = JSON.parse(auth);
    const now = Date.now();
    if (authData.token && now - authData.timestamp < SESSION_TIMEOUT) {
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

// Activity tracking
document.addEventListener('click', () => lastActivity = Date.now());
document.addEventListener('keypress', () => lastActivity = Date.now());
setInterval(() => {
  if (Date.now() - lastActivity > SESSION_TIMEOUT) logout();
}, 60000);

// ============================================
// STEP 1: STATIC PIN
// ============================================
document.getElementById('step1Form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const staticPin = document.getElementById('staticPin').value;
  const errorDiv = document.getElementById('step1Error');
  const button = document.getElementById('step1Button');

  errorDiv.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Verifying...';

  try {
    let recaptchaToken;
    try {
      recaptchaToken = await executeRecaptcha('dashboard_login');
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.add('show');
      button.disabled = false;
      button.textContent = 'Continue';
      return;
    }

    const response = await fetch('/.netlify/functions/verify-static-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staticPin, recaptchaToken })
    });
    
    const data = await response.json();

    if (response.status === 429) {
      const minutes = Math.ceil((data.retryAfter || 1800) / 60);
      errorDiv.textContent = data.error || `Too many attempts. Try again in ${minutes} minutes.`;
      errorDiv.classList.add('show');
      button.disabled = true;
      button.textContent = `Locked (${minutes}m)`;
      setTimeout(() => {
        button.disabled = false;
        button.textContent = 'Continue';
      }, data.retryAfter * 1000);
      return;
    }

    if (!response.ok || !data.valid) {
      let errorMsg = data.error || 'Invalid PIN';
      if (data.attemptsLeft !== undefined) {
        errorMsg += ` (${data.attemptsLeft} attempts left)`;
      }
      errorDiv.textContent = errorMsg;
      errorDiv.classList.add('show');
      button.disabled = false;
      button.textContent = 'Continue';
      return;
    }

    // Success - go to step 2
    staticPinValue = staticPin;
    document.getElementById('step1Container').style.display = 'none';
    document.getElementById('step2Container').style.display = 'block';
    
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
    errorDiv.classList.add('show');
    button.disabled = false;
    button.textContent = 'Continue';
  }
});

// Back to step 1
document.getElementById('backToStep1').addEventListener('click', () => {
  document.getElementById('step2Container').style.display = 'none';
  document.getElementById('step1Container').style.display = 'block';
  document.getElementById('staticPin').value = '';
  staticPinValue = '';
});

// ============================================
// STEP 2: TIME-BASED PIN
// ============================================
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

    if (response.status === 429) {
      const minutes = Math.ceil((data.retryAfter || 1800) / 60);
      errorDiv.textContent = data.error || `Too many attempts. Try again in ${minutes} minutes.`;
      errorDiv.classList.add('show');
      button.disabled = true;
      button.textContent = `Locked (${minutes}m)`;
      setTimeout(() => {
        button.disabled = false;
        button.textContent = 'Authenticate';
      }, data.retryAfter * 1000);
      return;
    }

    if (!response.ok || !data.authenticated) {
      let errorMsg = data.error || 'Invalid code';
      if (data.attemptsLeft !== undefined) {
        errorMsg += ` (${data.attemptsLeft} attempts left)`;
      }
      errorDiv.textContent = errorMsg;
      errorDiv.classList.add('show');
      button.disabled = false;
      button.textContent = 'Authenticate';
      return;
    }

    // Success
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      authenticated: true,
      timestamp: Date.now(),
      token: data.token
    }));
    showDashboard();
    loadMessages();
    
  } catch (error) {
    errorDiv.textContent = 'Connection error. Please try again.';
    errorDiv.classList.add('show');
    button.disabled = false;
    button.textContent = 'Authenticate';
  }
});

// ============================================
// DASHBOARD DISPLAY
// ============================================
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
    const authData = JSON.parse(localStorage.getItem(AUTH_KEY));
    const response = await fetch('/.netlify/functions/get-messages', {
      headers: {
        'Authorization': authData.token || ''
      }
    });

    if (!response.ok) throw new Error('Failed to load');
    
    const data = await response.json();
    messages = data.messages || [];
    updateStats();
    filterAndDisplayMessages();
    
  } catch (error) {
    container.innerHTML = `
      <div class="empty-letterbox">
        <div class="empty-icon">📭</div>
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
        <div class="empty-icon">📬</div>
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
            <div class="letter-date">${escapeHtml(formatDate(letter.timestamp))}</div>
            <div class="letter-session">${escapeHtml(letter.sessionId)}</div>
          </div>
          <div class="letter-icon">✉️</div>
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
            <span style="font-size: 1.5rem;">💬</span> <span>Share on WhatsApp</span>
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
            <span style="font-size: 1.5rem;">📋</span> <span>Copy Text</span>
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

// ============================================
// INITIALIZE
// ============================================
checkAuth();