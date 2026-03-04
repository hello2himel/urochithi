// ============================================
// NETLIFY FUNCTION - UPDATE USER SETTINGS
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
    if (!payload) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid session" })
      };
    }
    const authUserId = payload.sub;

    const body = JSON.parse(event.body);
    const { action } = body;

    const neonAuthUrl = process.env.NEON_AUTH_URL;
    if (!neonAuthUrl) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Auth not configured" })
      };
    }

    const db = getDB();
    await ensureSchema();

    // Handle different update actions
    if (action === 'update-name') {
      const { name } = body;
      if (!name || name.trim().length === 0) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Name is required" })
        };
      }

      // Update name via Neon Auth
      const response = await fetch(`${neonAuthUrl}/api/auth/update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim() })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: data.message || "Failed to update name" })
        };
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, message: "Name updated" })
      };
    }

    if (action === 'update-username') {
      const { username } = body;
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
          body: JSON.stringify({ error: "Username must contain at least 3 valid characters" })
        };
      }

      // Check if username is taken by someone else
      const existing = await db`SELECT auth_user_id FROM users WHERE username = ${cleanUsername}`;
      if (existing.length > 0 && existing[0].auth_user_id !== authUserId) {
        return {
          statusCode: 409,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Username already taken" })
        };
      }

      // Get old username for updating messages
      const currentUser = await db`SELECT username FROM users WHERE auth_user_id = ${authUserId}`;
      if (currentUser.length === 0) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "User not found" })
        };
      }

      const oldUsername = currentUser[0].username;

      // Update username
      await db`UPDATE users SET username = ${cleanUsername} WHERE auth_user_id = ${authUserId}`;

      // Update recipient in messages table
      await db`UPDATE messages SET recipient = ${cleanUsername} WHERE recipient = ${oldUsername}`;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, username: cleanUsername, message: "Username updated" })
      };
    }

    if (action === 'update-email') {
      const { newEmail } = body;
      if (!newEmail || !newEmail.includes('@')) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Valid email is required" })
        };
      }

      // Check if email is already used by another user in local DB
      const existingEmail = await db`SELECT auth_user_id FROM users WHERE email = ${newEmail.trim().toLowerCase()}`;
      if (existingEmail.length > 0 && existingEmail[0].auth_user_id !== authUserId) {
        return {
          statusCode: 409,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Email already in use" })
        };
      }

      // Update email via Neon Auth
      const response = await fetch(`${neonAuthUrl}/api/auth/change-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newEmail: newEmail.trim() })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: data.message || "Failed to update email" })
        };
      }

      // Update email in local DB
      await db`UPDATE users SET email = ${newEmail.trim().toLowerCase()} WHERE auth_user_id = ${authUserId}`;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, message: "Email updated" })
      };
    }

    if (action === 'change-password') {
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Current and new passwords are required" })
        };
      }

      if (newPassword.length < 8) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "New password must be at least 8 characters" })
        };
      }

      // Change password via Neon Auth
      const response = await fetch(`${neonAuthUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: data.message || "Failed to change password" })
        };
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, message: "Password changed" })
      };
    }

    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid action" })
    };

  } catch (error) {
    console.error('Error in update-settings:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Update failed" })
    };
  }
}
