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
  onboardingUrl: "/onboard.html",

  // Your live site URL (used for sharing, footer hook, etc.)
  siteUrl: "https://urochithi.netlify.app",

  // Auth0 Configuration (public keys - safe to expose)
  // Get these from: https://manage.auth0.com
  auth0Domain: "YOUR_AUTH0_DOMAIN",
  auth0ClientId: "YOUR_AUTH0_CLIENT_ID",
  auth0Audience: "YOUR_AUTH0_AUDIENCE"
};

// ============================================
// LOCAL STORAGE KEYS
// ============================================
const STORAGE_KEYS = {
  draft: 'urochithi_draft',
  sessionId: 'urochithi_session_id'
};

// Export for use in main.js and dashboard.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, STORAGE_KEYS };
} else if (typeof window !== 'undefined') {
  // Make available globally for browser use
  window.UROCHITHI_CONFIG = { CONFIG, STORAGE_KEYS };
}