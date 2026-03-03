// ============================================
// NETLIFY SERVERLESS FUNCTION - SUBMIT
// ============================================

import { getDB, ensureSchema } from './db.js';
import { checkRateLimit, getClientIP } from './rate-limiter.js';

export async function handler(event) {
  // Only accept POST requests
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const data = JSON.parse(event.body);

    // ============================================
    // HONEYPOT CHECK (Spam Prevention)
    // ============================================
    if (data.website) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid request" })
      };
    }

    // ============================================
    // RATE LIMITING
    // ============================================
    const clientIP = getClientIP(event);
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: rateCheck.error })
      };
    }

    // ============================================
    // INPUT VALIDATION
    // ============================================
    if (!data.message || data.message.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message is required" })
      };
    }

    if (data.message.length > 2000) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message must be under 2000 characters" })
      };
    }

    if (!data.sessionId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Session ID required" })
      };
    }

    if (!data.recipient) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Recipient is required" })
      };
    }

    // ============================================
    // STORE IN NEON DB
    // ============================================
    const db = getDB();
    await ensureSchema();

    const recipient = data.recipient.trim().toLowerCase();

    await db`
      INSERT INTO messages (recipient, message, session_id)
      VALUES (${recipient}, ${data.message.trim()}, ${data.sessionId})
    `;

    // ============================================
    // SUCCESS RESPONSE
    // ============================================
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        message: "Letter delivered successfully"
      })
    };

  } catch (error) {
    console.error("Error processing submission:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Failed to deliver letter",
        details: error.message
      })
    };
  }
}