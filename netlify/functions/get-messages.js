// ============================================
// NETLIFY FUNCTION - GET MESSAGES
// ============================================
// Fetch all messages from Google Sheets

import crypto from 'crypto';

function verifyAuthToken(token) {
  const secret = process.env.DASHBOARD_PIN;
  if (!secret) return { valid: false, error: 'Server configuration error' };

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, error: 'Invalid token format' };

    const [payload, signature] = parts;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());

    if (!data.authenticated || !data.timestamp) {
      return { valid: false, error: 'Invalid token data' };
    }

    // Check if session is still valid (30 minutes)
    const now = Date.now();
    if (now - data.timestamp > 30 * 60 * 1000) {
      return { valid: false, error: 'Session expired' };
    }

    // Verify HMAC signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid authentication' };
  }
}

export async function handler(event) {
  // Only accept GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    // ============================================
    // VERIFY AUTHENTICATION
    // ============================================
    const authHeader = event.headers.authorization;
    
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const authResult = verifyAuthToken(authHeader);
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: authResult.error })
      };
    }

    // ============================================
    // CHECK ENVIRONMENT VARIABLE
    // ============================================
    if (!process.env.GSCRIPT_URL) {
      console.error('GSCRIPT_URL environment variable not set');
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Server configuration error" })
      };
    }

    // ============================================
    // FETCH FROM GOOGLE SHEETS
    // ============================================
    const response = await fetch(process.env.GSCRIPT_URL, {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API returned ${response.status}`);
    }

    const data = await response.json();

    // ============================================
    // SUCCESS RESPONSE
    // ============================================
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
      body: JSON.stringify({
        messages: data.messages || [],
        count: data.messages?.length || 0
      })
    };

  } catch (error) {
    console.error("Error fetching messages:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch messages" })
    };
  }
}