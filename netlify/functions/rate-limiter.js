// ============================================
// RATE LIMITER UTILITY
// ============================================
// In-memory rate limiting with exponential backoff
// Note: Resets on function cold starts, but provides protection

const attempts = new Map(); // IP -> { count, lastAttempt, blockedUntil }

const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,           // Max attempts before blocking
  windowMs: 15 * 60 * 1000, // 15 minutes window
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block
  exponentialBase: 2        // Exponential backoff multiplier
};

/**
 * Check if IP is rate limited
 * @param {string} ip - Client IP address
 * @returns {Object} { allowed: boolean, retryAfter?: number, attemptsLeft?: number }
 */
export function checkRateLimit(ip) {
  if (!ip) {
    return { allowed: false, error: 'IP address required' };
  }

  const now = Date.now();
  const record = attempts.get(ip);

  // No previous attempts
  if (!record) {
    attempts.set(ip, {
      count: 1,
      lastAttempt: now,
      blockedUntil: null
    });
    return { 
      allowed: true, 
      attemptsLeft: RATE_LIMIT_CONFIG.maxAttempts - 1 
    };
  }

  // Check if currently blocked
  if (record.blockedUntil && now < record.blockedUntil) {
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
    return { 
      allowed: false, 
      retryAfter,
      error: `Too many attempts. Try again in ${retryAfter} seconds.`
    };
  }

  // Reset if outside time window
  if (now - record.lastAttempt > RATE_LIMIT_CONFIG.windowMs) {
    attempts.set(ip, {
      count: 1,
      lastAttempt: now,
      blockedUntil: null
    });
    return { 
      allowed: true, 
      attemptsLeft: RATE_LIMIT_CONFIG.maxAttempts - 1 
    };
  }

  // Increment attempts
  record.count++;
  record.lastAttempt = now;

  // Check if exceeded max attempts
  if (record.count >= RATE_LIMIT_CONFIG.maxAttempts) {
    // Calculate exponential backoff
    const excessAttempts = record.count - RATE_LIMIT_CONFIG.maxAttempts;
    const backoffMultiplier = Math.pow(RATE_LIMIT_CONFIG.exponentialBase, excessAttempts);
    const blockDuration = RATE_LIMIT_CONFIG.blockDurationMs * backoffMultiplier;
    
    record.blockedUntil = now + blockDuration;
    attempts.set(ip, record);

    const retryAfter = Math.ceil(blockDuration / 1000);
    return { 
      allowed: false, 
      retryAfter,
      error: `Too many failed attempts. Account temporarily locked for ${Math.ceil(retryAfter / 60)} minutes.`
    };
  }

  attempts.set(ip, record);
  return { 
    allowed: true, 
    attemptsLeft: RATE_LIMIT_CONFIG.maxAttempts - record.count 
  };
}

/**
 * Reset rate limit for IP (call on successful login)
 * @param {string} ip - Client IP address
 */
export function resetRateLimit(ip) {
  if (ip) {
    attempts.delete(ip);
  }
}

/**
 * Get client IP from event
 * @param {Object} event - Netlify function event
 * @returns {string} IP address
 */
export function getClientIP(event) {
  // Netlify provides IP in headers
  return event.headers['x-nf-client-connection-ip'] || 
         event.headers['x-forwarded-for']?.split(',')[0] || 
         event.headers['client-ip'] ||
         'unknown';
}

/**
 * Clean up old entries (optional, call periodically)
 */
export function cleanupOldEntries() {
  const now = Date.now();
  const maxAge = RATE_LIMIT_CONFIG.windowMs * 2;
  
  for (const [ip, record] of attempts.entries()) {
    if (now - record.lastAttempt > maxAge) {
      attempts.delete(ip);
    }
  }
}