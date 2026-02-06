-- Misconception Database Schema
-- Run this in Supabase SQL Editor

-- Table 1: Log failed explanations
create table if not exists misconception_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  paragraph_id uuid references paragraphs(id),
  concept text,
  failed_analogy text,
  user_interest text,
  created_at timestamp default now()
);

-- Table 2: Track successful analogies
create table if not exists successful_analogies (
  id uuid primary key default gen_random_uuid(),
  concept text,
  user_interest text,
  analogy_text text,
  success_count int default 1,
  created_at timestamp default now(),
  unique(concept, user_interest)
);

-- Index for fast lookups
create index if not exists idx_successful_analogies_concept 
  on successful_analogies(concept, user_interest);

-- RLS Policies
alter table misconception_logs enable row level security;
alter table successful_analogies enable row level security;

-- Users can insert their own misconception logs
create policy "Users can insert own misconception logs"
  on misconception_logs for insert
  with check (auth.uid() = user_id);

-- Anyone can read successful analogies (aggregated data)
create policy "Anyone can read successful analogies"
  on successful_analogies for select
  using (true);

-- Service role can insert/update successful analogies
create policy "Service can manage successful analogies"
  on successful_analogies for all
  using (true);
