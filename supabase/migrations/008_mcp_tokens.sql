-- Personal API tokens for the MCP server.
-- Each row binds a hashed bearer token to a household + user. The MCP
-- handler hashes incoming bearers and looks up the household_id to scope
-- every query. Raw tokens are never stored.

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  last_four TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_household ON mcp_tokens(household_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_tokens(user_id);

ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;

-- Users may read only their own tokens — never the hash, but the metadata.
CREATE POLICY "Users can view own mcp_tokens"
  ON mcp_tokens FOR SELECT
  USING (user_id = auth.uid());

-- Users may create tokens scoped to themselves.
CREATE POLICY "Users can create own mcp_tokens"
  ON mcp_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users may revoke their own tokens.
CREATE POLICY "Users can delete own mcp_tokens"
  ON mcp_tokens FOR DELETE
  USING (user_id = auth.uid());

-- The MCP server reads tokens with the service-role key, which bypasses RLS.
