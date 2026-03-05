// ============================================
// NETLIFY FUNCTION - VERIFY TIME PIN (Step 2)
// With Rate Limiting
// ============================================

import { checkRateLimit, getClientIP, resetRateLimit } from './rate-limiter.js';
import crypto from 'crypto';

// ============================================
// SAFE ARITHMETIC EVALUATOR
// ============================================
// Replaces Function() eval with a tokenizer + parser
// that only supports: +, -, *, /, %, (, ), and numeric values
function safeEvalArithmetic(expression, hour, minute) {
  const expr = expression
    .replace(/hour/g, String(hour))
    .replace(/minute/g, String(minute));

  // Validate: only allow digits, whitespace, and arithmetic operators
  if (!/^[\d\s+\-*/%().]+$/.test(expr)) {
    throw new Error('Expression contains disallowed characters');
  }

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }
    if (/\d/.test(expr[i]) || (expr[i] === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) {
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
    } else if ('+-*/%()'.includes(expr[i])) {
      tokens.push({ type: 'op', value: expr[i] });
      i++;
    } else {
      throw new Error(`Unexpected character: ${expr[i]}`);
    }
  }

  // Recursive descent parser
  let pos = 0;
  function peek() { return pos < tokens.length ? tokens[pos] : null; }
  function consume() { return tokens[pos++]; }

  function parseExpr() {
    let left = parseTerm();
    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (peek() && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
      const op = consume().value;
      const right = parseFactor();
      if (op === '*') left = left * right;
      else if (op === '/') left = right !== 0 ? left / right : 0;
      else left = left % right;
    }
    return left;
  }

  function parseFactor() {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.type === 'number') { consume(); return t.value; }
    if (t.value === '(') {
      consume();
      const val = parseExpr();
      if (!peek() || peek().value !== ')') throw new Error('Missing closing parenthesis');
      consume();
      return val;
    }
    // Handle unary minus
    if (t.value === '-') {
      consume();
      return -parseFactor();
    }
    if (t.value === '+') {
      consume();
      return parseFactor();
    }
    throw new Error(`Unexpected token: ${t.value}`);
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error('Unexpected tokens after expression');
  return Math.floor(result);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const clientIP = getClientIP(event);

  try {
    const { staticPin, timePin } = JSON.parse(event.body);

    // ============================================
    // RATE LIMITING CHECK
    // ============================================
    const rateCheck = checkRateLimit(clientIP);
    
    if (!rateCheck.allowed) {
      return {
        statusCode: 429,
        headers: { 
          "Content-Type": "application/json",
          "Retry-After": rateCheck.retryAfter || 1800
        },
        body: JSON.stringify({ 
          authenticated: false,
          error: rateCheck.error,
          retryAfter: rateCheck.retryAfter
        })
      };
    }

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
    
    let correctTimePin;
    try {
      correctTimePin = safeEvalArithmetic(algorithm, hour, minute);
    } catch (e) {
      console.error('Invalid algorithm:', e.message);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid algorithm configuration" })
      };
    }
    
    // Also calculate for previous and next minute (3-minute window)
    const prevMinute = minute === 0 ? 59 : minute - 1;
    const prevHour = minute === 0 ? (hour === 0 ? 23 : hour - 1) : hour;
    const prevTimePin = safeEvalArithmetic(algorithm, prevHour, prevMinute);
    
    const nextMinute = minute === 59 ? 0 : minute + 1;
    const nextHour = minute === 59 ? (hour === 23 ? 0 : hour + 1) : hour;
    const nextTimePin = safeEvalArithmetic(algorithm, nextHour, nextMinute);
    
    const timePinNum = parseInt(timePin, 10);
    
    if (timePinNum !== correctTimePin && timePinNum !== prevTimePin && timePinNum !== nextTimePin) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          authenticated: false,
          error: "Invalid time-based code",
          attemptsLeft: rateCheck.attemptsLeft
        })
      };
    }

    // ============================================
    // SUCCESS - RESET RATE LIMIT & GENERATE TOKEN
    // ============================================
    resetRateLimit(clientIP);

    // Generate HMAC-signed auth token
    const secret = process.env.DASHBOARD_PIN;
    const payload = Buffer.from(JSON.stringify({
      authenticated: true,
      timestamp: Date.now()
    })).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');
    const authToken = `${payload}.${signature}`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        authenticated: true,
        message: "Authentication successful",
        token: authToken
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