// ============================================
// NETLIFY FUNCTION - LOOKUP EMAIL BY USERNAME
// ============================================
// Used during login when user enters a username instead of email.

import { getDB, ensureSchema } from './db.js';

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { username } = JSON.parse(event.body);

    if (!username || username.trim().length < 3) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid username" })
      };
    }

    const cleanUsername = username.trim().toLowerCase();

    const db = getDB();
    await ensureSchema();

    const user = await db`SELECT email FROM users WHERE username = ${cleanUsername}`;

    if (user.length === 0 || !user[0].email) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "No account found with that username" })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user[0].email })
    };

  } catch (error) {
    console.error('Error in lookup-email:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Lookup failed" })
    };
  }
}
