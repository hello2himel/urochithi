// ============================================
// NEON DB CONNECTION UTILITY
// ============================================

import { neon } from '@neondatabase/serverless';

let sql;

export function getDB() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

export async function ensureSchema() {
  const db = getDB();
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      auth0_id VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      recipient VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      session_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)
  `;
}
