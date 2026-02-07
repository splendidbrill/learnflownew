-- Add qstash_schedule_id_3 column for 3-minute reminders
-- Run this in Supabase SQL Editor

ALTER TABLE study_schedules 
ADD COLUMN IF NOT EXISTS qstash_schedule_id_3 TEXT;
