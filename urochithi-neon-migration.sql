-- ============================================
-- UROCHITHI - NEON DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Messages table (replaces Google Sheets)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message TEXT NOT NULL,
  session_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_is_read ON messages(is_read) WHERE NOT is_archived;

-- Rate limiting table (replaces in-memory Map)
CREATE TABLE rate_limits (
  ip_address INET PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_blocked ON rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- Admin users table (for proper dashboard auth)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  totp_secret VARCHAR(32), -- For 2FA
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Auth sessions table
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_sessions_token ON auth_sessions(token) WHERE expires_at > NOW();
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Auto-cleanup old sessions (requires pg_cron extension)
-- DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '7 days';

-- Automatic timestamp cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Clean up rate limits older than 24 hours
  DELETE FROM rate_limits 
  WHERE last_attempt < NOW() - INTERVAL '24 hours' 
    AND blocked_until IS NULL;
  
  -- Clean up expired sessions
  DELETE FROM auth_sessions 
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Statistics view
CREATE VIEW message_stats AS
SELECT
  COUNT(*) as total_messages,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as today_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as week_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as month_count,
  COUNT(*) FILTER (WHERE is_read = false AND is_archived = false) as unread_count
FROM messages;

-- Grant permissions (adjust role name as needed)
-- GRANT SELECT, INSERT ON messages TO urochithi_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO urochithi_app;
