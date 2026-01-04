// ============================================
// NETLIFY SERVERLESS FUNCTION - SUBMIT
// ============================================

export async function handler(event) {
  // Only accept POST requests
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const data = JSON.parse(event.body);

    console.log('Received data:', data);

    // ============================================
    // HONEYPOT CHECK (Spam Prevention)
    // ============================================
    if (data.website) {
      console.log('Bot detected via honeypot field');
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid request" })
      };
    }

    // ============================================
    // INPUT VALIDATION
    // ============================================
    if (!data.message || data.message.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message is required" })
      };
    }

    if (data.message.length > 2000) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message must be under 2000 characters" })
      };
    }

    if (!data.sessionId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Session ID required" })
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
        body: JSON.stringify({ error: "Server configuration error - GSCRIPT_URL not set" })
      };
    }

    // ============================================
    // PREPARE PAYLOAD FOR GOOGLE SHEETS
    // ============================================
    const payload = {
      message: data.message.trim(),
      timestamp: new Date().toISOString(),
      sessionId: data.sessionId
    };

    console.log('Sending to Google Sheets:', payload);
    console.log('GSCRIPT_URL:', process.env.GSCRIPT_URL);

    // ============================================
    // SEND TO GOOGLE SHEETS
    // ============================================
    const response = await fetch(process.env.GSCRIPT_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log('Google Sheets response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Sheets error:', errorText);
      throw new Error(`Google Sheets API returned ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Google Sheets response data:', responseData);

    // ============================================
    // SUCCESS RESPONSE
    // ============================================
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        ok: true,
        message: "Letter delivered successfully"
      })
    };

  } catch (error) {
    // ============================================
    // ERROR HANDLING
    // ============================================
    console.error("Error processing submission:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        error: "Failed to deliver letter",
        details: error.message
      })
    };
  }
}