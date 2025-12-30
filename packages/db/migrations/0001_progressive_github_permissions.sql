-- Migration: Add Progressive GitHub Permissions
-- Created: 2025-12-30
-- Description: Adds columns to support progressive GitHub permissions and multiple auth methods

-- Add progressive permissions tracking to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS has_public_repo_scope BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS has_private_repo_scope BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS scopes_granted_at TIMESTAMP;

-- Add GitHub auth type tracking to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS github_auth_type TEXT,
ADD COLUMN IF NOT EXISTS github_installation_id TEXT,
ADD COLUMN IF NOT EXISTS github_repo_id TEXT;

-- Migrate existing data: set all existing projects to 'oauth' auth type
UPDATE projects
SET github_auth_type = 'oauth'
WHERE github_auth_type IS NULL;

-- Migrate existing users: mark them as having public repo scope
-- (Conservative assumption - they may have more but at least this)
UPDATE users
SET has_public_repo_scope = true,
    scopes_granted_at = NOW()
WHERE github_access_token IS NOT NULL AND has_public_repo_scope = false;
