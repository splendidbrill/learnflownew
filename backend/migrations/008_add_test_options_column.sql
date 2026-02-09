-- Add missing 'options' column to test_questions table
-- This column stores MCQ options as a JSONB array

ALTER TABLE test_questions 
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_test_questions_session_id ON test_questions(session_id);
