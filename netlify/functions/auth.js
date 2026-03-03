// ============================================
// AUTH0 JWT VERIFICATION UTILITY
// ============================================

import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;

export async function verifyToken(token) {
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;

  if (!domain) throw new Error('AUTH0_DOMAIN environment variable not set');
  if (!audience) throw new Error('AUTH0_AUDIENCE environment variable not set');

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://${domain}/`,
    audience: audience,
  });

  return payload;
}

export function extractToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
}
