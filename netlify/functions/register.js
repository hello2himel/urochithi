// ============================================
// NETLIFY FUNCTION - REGISTER USERNAME
// ============================================

import { getDB, ensureSchema } from './db.js';
import { verifyToken, extractToken } from './auth.js';

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    // Verify auth token
    const token = extractToken(event);
    if (!token) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const payload = await verifyToken(token);
    const authUserId = payload.sub;

    const { username } = JSON.parse(event.body);

    // Validate username
    if (!username || username.trim().length < 3 || username.trim().length > 30) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Username must be 3-30 characters" })
      };
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanUsername.length < 3) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Username must contain at least 3 valid characters (a-z, 0-9, _, -)" })
      };
    }

    const db = getDB();
    await ensureSchema();

    // Check if username is taken
    const existing = await db`SELECT id FROM users WHERE username = ${cleanUsername}`;
    if (existing.length > 0) {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Username already taken" })
      };
    }

    // Check if user already has a username
    const existingUser = await db`SELECT username FROM users WHERE auth_user_id = ${authUserId}`;
    if (existingUser.length > 0) {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "You already have a username", username: existingUser[0].username })
      };
    }

    // Register username
    await db`
      INSERT INTO users (auth_user_id, username, email)
      VALUES (${authUserId}, ${cleanUsername}, ${payload.email || null})
    `;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, username: cleanUsername })
    };

  } catch (error) {
    console.error('Error in register:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Registration failed" })
    };
  }
}
