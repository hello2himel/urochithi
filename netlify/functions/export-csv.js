// ============================================
// NETLIFY FUNCTION - EXPORT CSV
// ============================================

import { getDB, ensureSchema } from './db.js';
import { verifyToken, extractToken } from './auth.js';

function escapeCSVField(field) {
  const str = String(field || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    // Verify Auth0 token
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

    // Get user's username
    const user = await db`SELECT username FROM users WHERE auth_user_id = ${authUserId}`;
    if (user.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Please register a username first" })
      };
    }

    const username = user[0].username;

    // Fetch all messages
    const messages = await db`
      SELECT message, session_id, created_at
      FROM messages
      WHERE recipient = ${username}
      ORDER BY created_at ASC
    `;

    // Build CSV
    const header = 'Timestamp,Message,Session ID';
    const rows = messages.map(m =>
      [
        escapeCSVField(m.created_at ? new Date(m.created_at).toISOString() : ''),
        escapeCSVField(m.message),
        escapeCSVField(m.session_id)
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="urochithi-${username}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-cache"
      },
      body: csv
    };

  } catch (error) {
    console.error('Error in export-csv:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Export failed" })
    };
  }
}
