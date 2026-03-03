// ============================================
// NETLIFY FUNCTION - CHECK USER STATUS
// ============================================

import { getDB, ensureSchema } from './db.js';
import { verifyToken, extractToken } from './auth.js';

export async function handler(event) {
  if (event.httpMethod !== "GET") {
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

    const db = getDB();
    await ensureSchema();

    // Check if user exists
    const user = await db`SELECT username, email, created_at FROM users WHERE auth_user_id = ${authUserId}`;

    if (user.length === 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registered: false })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registered: true,
        username: user[0].username,
        email: user[0].email,
        createdAt: user[0].created_at
      })
    };

  } catch (error) {
    console.error('Error in check-user:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to check user status" })
    };
  }
}
