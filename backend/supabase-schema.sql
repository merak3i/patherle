-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Tenants table: stores business/client information
CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT,
  -- WhatsApp Business API
  whatsapp_number TEXT UNIQUE,
  whatsapp_token TEXT,
  whatsapp_phone_id TEXT,
  -- Telegram Bot API
  telegram_bot_token TEXT,
  telegram_bot_username TEXT,
  bot_greeting TEXT,
  -- Plan & usage
  plan TEXT DEFAULT 'free',
  monthly_message_limit INTEGER DEFAULT 50,
  messages_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add new columns to existing tenants table (safe to run multiple times)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_phone_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bot_greeting TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS monthly_message_limit INTEGER DEFAULT 50;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;
-- Tier column (1=Starter, 2=Growth, 3=Enterprise) derived from plan but stored for fast filtering
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_tier SMALLINT DEFAULT 1;

-- ── Crawl Jobs table: tracks Cloudflare Browser Rendering crawl jobs ──────────
-- Used by Tier 2 (one-time website auto-sync) and Tier 3 (recurring daily sync)
CREATE TABLE IF NOT EXISTS tenant_crawl_jobs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  cf_job_id     TEXT,                          -- Cloudflare-assigned job ID
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  is_recurring  BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for Tier 3 daily sync jobs
  error         TEXT,                            -- error message if status = failed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_tenant   ON tenant_crawl_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status   ON tenant_crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_recurring ON tenant_crawl_jobs(is_recurring) WHERE is_recurring = TRUE;

-- Documents table: tracks uploaded knowledge base files
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT,
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, filename)
);

-- Query analytics table: tracks every RAG query for the analytics dashboard
CREATE TABLE IF NOT EXISTS queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  source TEXT DEFAULT 'api',       -- 'api' | 'whatsapp'
  response_ms INTEGER,             -- latency in ms
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table: for auth (email/password + google)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'starter',     -- 'starter' | 'growth' | 'enterprise'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
