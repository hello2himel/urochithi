// ============================================
// NETLIFY FUNCTION - VERIFY STATIC PIN (Step 1)
// With reCAPTCHA v3 and Rate Limiting
// ============================================

import { checkRateLimit, getClientIP, resetRateLimit } from './rate-limiter.js';
import { verifyRecaptcha } from './recaptcha-verify.js';

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const clientIP = getClientIP(event);
  console.log('Login attempt from IP:', clientIP);

  try {
    const { staticPin, recaptchaToken } = JSON.parse(event.body);

    // ============================================
    // RATE LIMITING CHECK
    // ============================================
    const rateCheck = checkRateLimit(clientIP);
    
    if (!rateCheck.allowed) {
      console.warn('Rate limit exceeded for IP:', clientIP);
      return {
        statusCode: 429,
        headers: { 
          "Content-Type": "application/json",
          "Retry-After": rateCheck.retryAfter || 1800
        },
        body: JSON.stringify({ 
          valid: false,
          error: rateCheck.error,
          retryAfter: rateCheck.retryAfter
        })
      };
    }

    // ============================================
    // RECAPTCHA V3 VERIFICATION
    // ============================================
    const recaptchaResult = await verifyRecaptcha(recaptchaToken, 'dashboard_login');
    
    if (!recaptchaResult.success) {
      console.warn('reCAPTCHA verification failed for IP:', clientIP);
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          valid: false,
          error: recaptchaResult.error || "Security verification failed. Please refresh and try again."
        })
      };
    }

    console.log('reCAPTCHA passed with score:', recaptchaResult.score);

    // ============================================
    // VERIFY STATIC PIN
    // ============================================
    const correctStaticPin = process.env.DASHBOARD_PIN;
    
    if (!correctStaticPin) {
      console.error('DASHBOARD_PIN environment variable not set');
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Server configuration error" })
      };
    }

    if (staticPin !== correctStaticPin) {
      console.warn('Invalid PIN attempt from IP:', clientIP);
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          valid: false,
          error: "Invalid PIN",
          attemptsLeft: rateCheck.attemptsLeft
        })
      };
    }

    // ============================================
    // SUCCESS - Don't reset rate limit yet, wait for Step 2
    // ============================================
    console.log('Step 1 successful for IP:', clientIP);
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        valid: true,
        message: "PIN verified. Please proceed to time verification."
      })
    };

  } catch (error) {
    console.error('Error in verify-static-pin:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        valid: false,
        error: "Authentication error" 
      })
    };
  }
}