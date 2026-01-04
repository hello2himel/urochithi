// ============================================
// UROCHITHI CONFIGURATION
// ============================================
// Edit these values to customize your site

const CONFIG = {
  // Your username (displayed as "to: @username")
  username: "hello2himel",
  
  // Site name (displayed in header)
  siteName: "UROCHITHI",
  
  // Tagline (displayed below site name)
  siteTagline: "Send anonymous letters",
  
  // Maximum characters allowed in a message
  maxMessageLength: 2000,
  
  // Onboarding page URL (for postage stamp link)
  onboardingUrl: "/onboard.html"
};

// ============================================
// LOCAL STORAGE KEYS
// ============================================
const STORAGE_KEYS = {
  draft: 'urochithi_draft',
  sessionId: 'urochithi_session_id'
};

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, STORAGE_KEYS };
}