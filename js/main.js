// ============================================
// UROCHITHI - MAIN JAVASCRIPT
// ============================================

// Recipient from URL path (domain.com/username)
let recipient = null;
let isHomePage = true;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Determine if we're on a username path or root homepage
  const path = window.location.pathname;
  if (path.length > 1 && !path.includes('.') && !path.startsWith('/dashboard') && !path.startsWith('/onboard') && !path.startsWith('/selfhost')) {
    recipient = path.substring(1).toLowerCase().replace(/\/$/, '');
    isHomePage = false;
  } else {
    isHomePage = true;
  }

  if (isHomePage) {
    // Show homepage
    document.getElementById('homePage').style.display = '';
    document.getElementById('letterPage').style.display = 'none';
    updateHomePage();
  } else {
    // Show letter form
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('letterPage').style.display = '';
    initLetterForm();
  }
});

// ============================================
// HOMEPAGE
// ============================================
function updateHomePage() {
  // Update site name on homepage
  const titleEls = document.querySelectorAll('.urochithi-title');
  titleEls.forEach(el => { el.textContent = CONFIG.siteName; });

  document.title = `${CONFIG.siteName} - Anonymous Letters`;
}

// ============================================
// LETTER FORM INITIALIZATION
// ============================================
function initLetterForm() {
  // DOM Elements (only exist on letter page)
  const form = document.getElementById("anonForm");
  const responseDiv = document.getElementById("response");
  const submitBtn = document.getElementById("submitBtn");
  const btnText = document.getElementById("btnText");
  const textarea = document.getElementById("messageBox");
  const charCounter = document.getElementById("charCounter");
  const honeypot = document.getElementById("website");

  // Session ID
  let currentSessionId = getOrCreateSessionId();

  // Update page with recipient info
  const recipientElement = document.querySelector('.urochithi-recipient');
  if (recipientElement) {
    recipientElement.textContent = `to: @${recipient}`;
  }

  const siteNameElement = document.querySelector('#letterPage .urochithi-title');
  if (siteNameElement) {
    siteNameElement.textContent = CONFIG.siteName;
  }

  const taglineElement = document.querySelector('#letterPage .urochithi-subtext:nth-child(2)');
  if (taglineElement) {
    taglineElement.textContent = CONFIG.siteTagline;
  }

  const stampLink = document.querySelector('.postage-stamp');
  if (stampLink) {
    stampLink.href = CONFIG.onboardingUrl;
  }

  document.title = `Send to @${recipient} - ${CONFIG.siteName}`;

  // Display session ID
  const sessionIdElement = document.getElementById('sessionIdDisplay');
  if (sessionIdElement && currentSessionId) {
    sessionIdElement.textContent = currentSessionId;
  }

  // Load draft
  const draft = localStorage.getItem(STORAGE_KEYS.draft);
  if (draft && textarea) {
    textarea.value = draft;
  }

  // Character counter
  function updateCharCounter() {
    const length = textarea.value.length;
    charCounter.textContent = `${length.toLocaleString()} / ${CONFIG.maxMessageLength.toLocaleString()}`;
    if (length > CONFIG.maxMessageLength * 0.9) {
      charCounter.classList.add('warning');
    } else {
      charCounter.classList.remove('warning');
    }
  }
  updateCharCounter();

  // Textarea events
  textarea.addEventListener('input', () => {
    updateCharCounter();
    if (textarea.value.trim()) {
      localStorage.setItem(STORAGE_KEYS.draft, textarea.value);
    } else {
      localStorage.removeItem(STORAGE_KEYS.draft);
    }
  });

  textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 350) + 'px';
  });

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (honeypot.value) return;

    if (textarea.value.length > CONFIG.maxMessageLength) {
      responseDiv.textContent = `Message too long! Maximum ${CONFIG.maxMessageLength.toLocaleString()} characters.`;
      responseDiv.className = "response error show";
      setTimeout(() => { responseDiv.className = "response error"; }, 5000);
      return;
    }

    if (!currentSessionId) {
      currentSessionId = getOrCreateSessionId();
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('btn-skeleton');
    btnText.innerHTML = '<span class="loading"></span>Sending...';
    responseDiv.className = "response";
    responseDiv.textContent = "";

    try {
      const payload = {
        message: textarea.value.trim(),
        sessionId: currentSessionId,
        recipient: recipient
      };

      const response = await fetch("/.netlify/functions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Network response was not ok");
      }

      responseDiv.textContent = "Your letter has been sent successfully!";
      responseDiv.className = "response success show";

      form.reset();
      localStorage.removeItem(STORAGE_KEYS.draft);
      updateCharCounter();

      setTimeout(() => { responseDiv.className = "response success"; }, 5000);

    } catch (error) {
      responseDiv.textContent = `Error: ${error.message || "Sorry, your letter couldn't be sent. Please try again."}`;
      responseDiv.className = "response error show";
      setTimeout(() => { responseDiv.className = "response error"; }, 8000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('btn-skeleton');
      btnText.textContent = "Send Letter";
    }
  });
}

// ============================================
// UTILITY - SESSION ID
// ============================================
function getOrCreateSessionId() {
  let sessionId = localStorage.getItem(STORAGE_KEYS.sessionId);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
  }
  return sessionId;
}