// ============================================
// NETLIFY FUNCTION - GET MESSAGES
// ============================================
// Fetch messages from Neon DB for authenticated user

import { getDB, ensureSchema } from './db.js';
import { verifyToken, extractToken } from './auth.js';

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
    // VERIFY AUTH0 TOKEN
    // ============================================
    const token = extractToken(event);
    if (!token) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const payload = await verifyToken(token);
    const auth0Id = payload.sub;

    const db = getDB();
    await ensureSchema();

    // ============================================
    // GET USER'S USERNAME
    // ============================================
    const user = await db`SELECT username FROM users WHERE auth0_id = ${auth0Id}`;
    if (user.length === 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], count: 0, needsRegistration: true })
      };
    }

    const username = user[0].username;

    // ============================================
    // FETCH FROM NEON DB
    // ============================================
    const messages = await db`
      SELECT id, message, session_id, created_at
      FROM messages
      WHERE recipient = ${username}
      ORDER BY created_at DESC
    `;

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
        messages: messages.map(m => ({
          id: m.id,
          message: m.message,
          sessionId: m.session_id,
          timestamp: m.created_at
        })),
        count: messages.length
      })
    };

  } catch (error) {
    console.error("Error fetching messages:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Failed to fetch messages",
        details: error.message
      })
    };
  }
}