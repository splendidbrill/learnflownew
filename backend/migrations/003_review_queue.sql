-- Review Queue System
-- Run this in Supabase SQL Editor

-- Add telegram_chat_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Create review_queue table
CREATE TABLE IF NOT EXISTS review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  concept TEXT NOT NULL,
  paragraph_id UUID,
  book_id UUID,
  chapter_id UUID,
  failed_explanation TEXT,
  next_review_date TIMESTAMP NOT NULL,
  interval_days INT DEFAULT 3,
  review_count INT DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, completed, skipped
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_review_queue_user_date 
  ON review_queue(user_id, next_review_date);

CREATE INDEX IF NOT EXISTS idx_review_queue_status 
  ON review_queue(user_id, status);

-- RLS Policies
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;

-- Users can only see their own reviews
CREATE POLICY "Users can view own reviews"
  ON review_queue FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews"
  ON review_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON review_queue FOR UPDATE
  USING (auth.uid() = user_id);
