// ============================================
// NETLIFY FUNCTION - VERIFY STATIC PIN (Step 1)
// ============================================

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { staticPin } = JSON.parse(event.body);

    const correctStaticPin = process.env.DASHBOARD_PIN;
    
    if (!correctStaticPin) {
      console.error('DASHBOARD_PIN environment variable not set');
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Server configuration error" })
      };
    }

    if (staticPin !== correctStaticPin) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          valid: false,
          error: "Invalid PIN" 
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        valid: true
      })
    };

  } catch (error) {
    console.error('Error in verify-static-pin:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        valid: false,
        error: "Authentication error" 
      })
    };
  }
}