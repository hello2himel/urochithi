// ============================================
// UROCHITHI - MAIN JAVASCRIPT
// ============================================

// DOM Elements
const form = document.getElementById("anonForm");
const responseDiv = document.getElementById("response");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");
const textarea = document.getElementById("messageBox");
const charCounter = document.getElementById("charCounter");
const honeypot = document.getElementById("website");

// Session ID storage
let currentSessionId = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Generate/retrieve session ID
  currentSessionId = getOrCreateSessionId();
  
  // Update page with config values
  updatePageConfig();
  
  // Load draft if exists
  loadDraft();
  
  // Initialize character counter
  updateCharCounter();
  
  // Display session ID
  displaySessionId();
});

// Get or create session ID
function getOrCreateSessionId() {
  let sessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
  
  if (!sessionId) {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    sessionId = `${timestamp}-${randomPart}`;
    localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
  }
  
  return sessionId;
}

// Update page with configuration values
function updatePageConfig() {
  const usernameElement = document.querySelector('.urochithi-subtext:last-child');
  if (usernameElement) {
    usernameElement.textContent = `to: @${CONFIG.username}`;
  }

  const siteNameElement = document.querySelector('.urochithi-title');
  if (siteNameElement) {
    siteNameElement.textContent = CONFIG.siteName;
  }

  const taglineElement = document.querySelector('.urochithi-subtext:nth-child(2)');
  if (taglineElement) {
    taglineElement.textContent = CONFIG.siteTagline;
  }
  
  const stampLink = document.querySelector('.postage-stamp');
  if (stampLink) {
    stampLink.href = CONFIG.onboardingUrl;
  }
}

// Display session ID
function displaySessionId() {
  const sessionIdElement = document.getElementById('sessionIdDisplay');
  if (sessionIdElement && currentSessionId) {
    sessionIdElement.textContent = `${currentSessionId}`;
  }
}

// ============================================
// DRAFT AUTO-SAVE FUNCTIONS
// ============================================

function loadDraft() {
  const draft = localStorage.getItem(STORAGE_KEYS.draft);
  if (draft && textarea) {
    textarea.value = draft;
    updateCharCounter();
  }
}

function saveDraft() {
  if (textarea && textarea.value.trim()) {
    localStorage.setItem(STORAGE_KEYS.draft, textarea.value);
  } else {
    localStorage.removeItem(STORAGE_KEYS.draft);
  }
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.draft);
}

// ============================================
// CHARACTER COUNTER
// ============================================

function updateCharCounter() {
  const length = textarea.value.length;
  charCounter.textContent = `${length.toLocaleString()} / ${CONFIG.maxMessageLength.toLocaleString()}`;
  
  if (length > CONFIG.maxMessageLength * 0.9) {
    charCounter.classList.add('warning');
  } else {
    charCounter.classList.remove('warning');
  }
}

// ============================================
// TEXTAREA EVENT LISTENERS
// ============================================

textarea.addEventListener('input', () => {
  updateCharCounter();
  saveDraft();
});

// Auto-resize textarea
textarea.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 350) + 'px';
});

// ============================================
// FORM SUBMISSION
// ============================================

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Honeypot check - if filled, it's a bot
  if (honeypot.value) {
    console.log('Bot detected');
    return;
  }
  
  // Validate message length
  if (textarea.value.length > CONFIG.maxMessageLength) {
    responseDiv.textContent = `Message too long! Maximum ${CONFIG.maxMessageLength.toLocaleString()} characters.`;
    responseDiv.className = "response error show";
    setTimeout(() => {
      responseDiv.className = "response error";
    }, 5000);
    return;
  }
  
  // Validate session ID exists
  if (!currentSessionId) {
    console.error('Session ID not found');
    currentSessionId = getOrCreateSessionId();
  }
  
  console.log('Submitting with session ID:', currentSessionId);
  
  // Show loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('btn-skeleton');
  btnText.innerHTML = '<span class="loading"></span>Sending...';
  responseDiv.className = "response";
  responseDiv.textContent = "";
  
  try {
    const payload = {
      message: textarea.value.trim(),
      sessionId: currentSessionId
    };
    
    console.log('Sending payload:', payload);
    
    const response = await fetch("/.netlify/functions/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Response status:', response.status);
    
    const responseData = await response.json();
    console.log('Response data:', responseData);
    
    if (!response.ok) {
      throw new Error(responseData.error || "Network response was not ok");
    }
    
    // Success
    responseDiv.textContent = "Your letter has been sent successfully!";
    responseDiv.className = "response success show";
    
    // Clear form and draft
    form.reset();
    clearDraft();
    updateCharCounter();
    
    // Hide success message after 5 seconds
    setTimeout(() => {
      responseDiv.className = "response success";
    }, 5000);
    
  } catch (error) {
    console.error('Submission error:', error);
    responseDiv.textContent = `Error: ${error.message || "Sorry, your letter couldn't be sent. Please try again."}`;
    responseDiv.className = "response error show";
    
    setTimeout(() => {
      responseDiv.className = "response error";
    }, 8000);
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.classList.remove('btn-skeleton');
    btnText.textContent = "Send Letter";
  }
});