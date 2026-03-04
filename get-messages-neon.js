// ============================================
// NETLIFY FUNCTION - GET MESSAGES (NEON VERSION)
// ============================================

import { neon } from '@neondatabase/serverless';

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const sql = neon(process.env.DATABASE_URL);

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

    try {
      const authData = JSON.parse(authHeader);
      
      if (!authData.authenticated || !authData.timestamp) {
        throw new Error('Invalid auth data');
      }
      
      // Check if session is still valid (30 minutes)
      const now = Date.now();
      if (now - authData.timestamp > 30 * 60 * 1000) {
        return {
          statusCode: 401,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Session expired" })
        };
      }
    } catch (e) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid authentication" })
      };
    }

    // ============================================
    // FETCH MESSAGES FROM NEON
    // ============================================
    console.log('Fetching messages from Neon database...');

    // Support filtering via query parameters
    const params = event.queryStringParameters || {};
    const limit = parseInt(params.limit) || 1000;
    const offset = parseInt(params.offset) || 0;
    const filter = params.filter || 'all'; // all, today, week, month, unread
    const search = params.search || '';
    const sessionId = params.sessionId || '';

    let whereConditions = ['is_archived = false'];
    let queryParams = [];

    // Date filters
    if (filter === 'today') {
      whereConditions.push("created_at::date = CURRENT_DATE");
    } else if (filter === 'week') {
      whereConditions.push("created_at > NOW() - INTERVAL '7 days'");
    } else if (filter === 'month') {
      whereConditions.push("created_at > NOW() - INTERVAL '30 days'");
    } else if (filter === 'unread') {
      whereConditions.push("is_read = false");
    }

    // Search filter
    if (search) {
      whereConditions.push(`message ILIKE $${queryParams.length + 1}`);
      queryParams.push(`%${search}%`);
    }

    // Session ID filter
    if (sessionId) {
      whereConditions.push(`session_id = $${queryParams.length + 1}`);
      queryParams.push(sessionId);
    }

    const whereClause = whereConditions.join(' AND ');

    // Fetch messages
    const messages = await sql`
      SELECT 
        id,
        message,
        session_id,
        created_at as timestamp,
        is_read,
        ip_address
      FROM messages
      WHERE ${sql.unsafe(whereClause)}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Fetch statistics
    const stats = await sql`SELECT * FROM message_stats`;

    console.log(`Fetched ${messages.length} messages`);

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
          timestamp: m.timestamp,
          isRead: m.is_read
        })),
        count: messages.length,
        stats: stats[0] || {},
        pagination: {
          limit,
          offset,
          hasMore: messages.length === limit
        }
      })
    };

  } catch (error) {
    console.error("Error fetching messages:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Failed to fetch messages",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
}
