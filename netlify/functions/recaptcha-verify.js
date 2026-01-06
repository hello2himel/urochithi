// ============================================
// RECAPTCHA V3 VERIFICATION UTILITY
// ============================================

/**
 * Verify reCAPTCHA v3 token with Google
 * @param {string} token - reCAPTCHA token from client
 * @param {string} expectedAction - Expected action name (e.g., 'dashboard_login')
 * @returns {Promise<Object>} { success: boolean, score?: number, error?: string }
 */
export async function verifyRecaptcha(token, expectedAction = 'dashboard_login') {
  if (!token) {
    return { 
      success: false, 
      error: 'reCAPTCHA token required' 
    };
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY not configured');
    return { 
      success: false, 
      error: 'reCAPTCHA not configured' 
    };
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`
    });

    if (!response.ok) {
      console.error('reCAPTCHA API error:', response.status);
      return { 
        success: false, 
        error: 'reCAPTCHA verification failed' 
      };
    }

    const data = await response.json();
    
    console.log('reCAPTCHA response:', {
      success: data.success,
      score: data.score,
      action: data.action,
      hostname: data.hostname
    });

    // Check if verification succeeded
    if (!data.success) {
      console.error('reCAPTCHA verification failed:', data['error-codes']);
      return { 
        success: false, 
        error: 'reCAPTCHA verification failed',
        errorCodes: data['error-codes']
      };
    }

    // Verify action matches (v3 only)
    if (data.action && data.action !== expectedAction) {
      console.error('reCAPTCHA action mismatch:', data.action, 'expected:', expectedAction);
      return { 
        success: false, 
        error: 'Invalid reCAPTCHA action' 
      };
    }

    // Check score threshold (v3 only)
    // Score ranges from 0.0 (bot) to 1.0 (human)
    // Recommended threshold: 0.5
    const threshold = 0.5;
    
    if (data.score !== undefined && data.score < threshold) {
      console.warn('reCAPTCHA score too low:', data.score);
      return { 
        success: false, 
        error: 'Suspicious activity detected. Please try again.',
        score: data.score 
      };
    }

    // Success!
    return { 
      success: true, 
      score: data.score,
      action: data.action,
      hostname: data.hostname
    };

  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { 
      success: false, 
      error: 'reCAPTCHA verification error' 
    };
  }
}