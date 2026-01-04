// ============================================
// NETLIFY FUNCTION - GET MESSAGES
// ============================================
// Fetch all messages from Google Sheets

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
    console.log('Fetching messages from Google Sheets...');
    
    const response = await fetch(process.env.GSCRIPT_URL, {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('Fetched', data.messages?.length || 0, 'messages');

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
      body: JSON.stringify({ 
        error: "Failed to fetch messages",
        details: error.message
      })
    };
  }
}