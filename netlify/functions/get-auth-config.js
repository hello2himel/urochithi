// ============================================
// NETLIFY FUNCTION - GET AUTH CONFIG
// ============================================
// Returns the public Neon Auth URL from environment variables.
// The Neon Auth URL is a public endpoint (safe to expose).

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const neonAuthUrl = process.env.NEON_AUTH_URL;
  if (!neonAuthUrl) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "NEON_AUTH_URL environment variable not set" })
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ neonAuthUrl })
  };
}
