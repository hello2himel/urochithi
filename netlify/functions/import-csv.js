// ============================================
// NETLIFY FUNCTION - IMPORT CSV
// ============================================
// Import messages from a Google Sheets CSV export

import { getDB, ensureSchema } from './db.js';
import { verifyToken, extractToken } from './auth.js';

function parseCSV(csvText) {
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.length > 0 || lines.length > 0) {
        lines.push(current);
        current = '';
      }
      if (lines.length > 0) {
        return { fields: lines, rest: csvText.slice(i + (csvText[i + 1] === '\n' ? 2 : 1)) };
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0 || lines.length > 0) {
    lines.push(current);
  }
  return { fields: lines, rest: '' };
}

function parseCSVFull(csvText) {
  const rows = [];
  let remaining = csvText.trim();

  while (remaining.length > 0) {
    const result = parseCSV(remaining);
    if (result.fields.length > 0) {
      rows.push(result.fields);
    }
    if (result.rest === remaining) break;
    remaining = result.rest;
  }

  return rows;
}

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
    const { csv } = JSON.parse(event.body);

    if (!csv || csv.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "CSV data is required" })
      };
    }

    // Parse CSV
    const rows = parseCSVFull(csv);

    if (rows.length < 2) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "CSV must have a header row and at least one data row" })
      };
    }

    // Detect column indices from header
    const header = rows[0].map(h => h.trim().toLowerCase());
    const timestampIdx = header.findIndex(h => h.includes('timestamp') || h.includes('date') || h.includes('time'));
    const messageIdx = header.findIndex(h => h.includes('message') || h.includes('letter') || h.includes('content'));
    const sessionIdx = header.findIndex(h => h.includes('session') || h.includes('id'));

    if (messageIdx === -1) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Could not find a message column. Expected column header containing 'Message', 'Letter', or 'Content'."
        })
      };
    }

    // Import data rows
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const message = row[messageIdx]?.trim();

      if (!message) {
        skipped++;
        continue;
      }

      const timestamp = timestampIdx >= 0 && row[timestampIdx]
        ? row[timestampIdx].trim()
        : null;
      const sessionId = sessionIdx >= 0 && row[sessionIdx]
        ? row[sessionIdx].trim()
        : 'imported';

      let createdAt;
      if (timestamp) {
        const parsed = new Date(timestamp);
        createdAt = isNaN(parsed.getTime()) ? new Date() : parsed;
      } else {
        createdAt = new Date();
      }

      await db`
        INSERT INTO messages (recipient, message, session_id, created_at)
        VALUES (${username}, ${message}, ${sessionId}, ${createdAt.toISOString()})
      `;
      imported++;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        imported,
        skipped,
        total: rows.length - 1
      })
    };

  } catch (error) {
    console.error('Error in import-csv:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Import failed: " + error.message })
    };
  }
}
