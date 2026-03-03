// ============================================
// NEON AUTH SESSION VERIFICATION UTILITY
// ============================================

export async function verifyToken(token) {
  const neonAuthUrl = process.env.NEON_AUTH_URL;
  if (!neonAuthUrl) throw new Error('NEON_AUTH_URL environment variable not set');

  const response = await fetch(`${neonAuthUrl}/api/auth/get-session`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    console.error('Auth verification failed:', response.status);
    return null;
  }

  const data = await response.json();
  if (!data.session || !data.user) return null;

  return {
    sub: data.user.id,
    email: data.user.email,
    name: data.user.name
  };
}

export function extractToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
}
