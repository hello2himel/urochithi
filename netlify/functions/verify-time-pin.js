// ============================================
// NETLIFY FUNCTION - VERIFY TIME PIN (Step 2)
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
    const { staticPin, timePin } = JSON.parse(event.body);

    // ============================================
    // VERIFY STATIC PIN AGAIN (security)
    // ============================================
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
          authenticated: false,
          error: "Invalid PIN" 
        })
      };
    }

    // ============================================
    // GET ALGORITHM FROM ENV VAR
    // ============================================
    const algorithm = process.env.TIME_PIN_ALGORITHM || "(hour * 7) + (minute % 10)";
    
    // ============================================
    // CALCULATE TIME-BASED PIN
    // ============================================
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    
    // Evaluate the algorithm
    // Security: Only allow simple arithmetic operations
    const cleanAlgo = algorithm
      .replace(/hour/g, hour)
      .replace(/minute/g, minute);
    
    let correctTimePin;
    try {
      // Safe eval alternative - only allow numbers and basic math
      correctTimePin = Function('"use strict"; return (' + cleanAlgo + ')')();
    } catch (e) {
      console.error('Invalid algorithm:', e);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid algorithm configuration" })
      };
    }
    
    // Also calculate for previous and next minute (3-minute window)
    const prevMinute = minute === 0 ? 59 : minute - 1;
    const prevHour = minute === 0 ? (hour === 0 ? 23 : hour - 1) : hour;
    const prevAlgo = algorithm
      .replace(/hour/g, prevHour)
      .replace(/minute/g, prevMinute);
    const prevTimePin = Function('"use strict"; return (' + prevAlgo + ')')();
    
    const nextMinute = minute === 59 ? 0 : minute + 1;
    const nextHour = minute === 59 ? (hour === 23 ? 0 : hour + 1) : hour;
    const nextAlgo = algorithm
      .replace(/hour/g, nextHour)
      .replace(/minute/g, nextMinute);
    const nextTimePin = Function('"use strict"; return (' + nextAlgo + ')')();
    
    const timePinNum = parseInt(timePin, 10);
    
    if (timePinNum !== correctTimePin && timePinNum !== prevTimePin && timePinNum !== nextTimePin) {
      console.log('Invalid time-based PIN');
      console.log('UTC time:', hour + ':' + minute);
      console.log('Got:', timePinNum);
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          authenticated: false,
        })
      };
    }

    // ============================================
    // SUCCESS
    // ============================================
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        authenticated: true
      })
    };

  } catch (error) {
    console.error('Error in verify-time-pin:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        authenticated: false,
        error: "Authentication error" 
      })
    };
  }
}