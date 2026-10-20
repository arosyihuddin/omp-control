CREATE TABLE IF NOT EXISTS auth_recovery_challenges (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_recovery_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_started_at INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0);
