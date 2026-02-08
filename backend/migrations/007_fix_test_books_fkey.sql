-- Migration: Fix test_sessions foreign key to use course_books instead of books
-- This fixes the issue where dashboard uses course_books but test system references books

-- 1. Add book_id column to test_sessions if it doesn't exist
ALTER TABLE test_sessions 
ADD COLUMN IF NOT EXISTS book_id UUID;

-- 2. Drop old foreign key constraint if it exists
ALTER TABLE test_sessions 
DROP CONSTRAINT IF EXISTS test_sessions_book_id_fkey;

-- 3. Add new foreign key to course_books
ALTER TABLE test_sessions
ADD CONSTRAINT test_sessions_book_id_fkey 
FOREIGN KEY (book_id) REFERENCES course_books(id) ON DELETE CASCADE;

-- 4. Same for test_questions - add column first
ALTER TABLE test_questions
ADD COLUMN IF NOT EXISTS book_id UUID;

-- 5. Drop old foreign key
ALTER TABLE test_questions
DROP CONSTRAINT IF EXISTS test_questions_book_id_fkey;

-- 6. Add new foreign key to course_books  
ALTER TABLE test_questions
ADD CONSTRAINT test_questions_book_id_fkey
FOREIGN KEY (book_id) REFERENCES course_books(id) ON DELETE CASCADE;

-- 7. Optional: Drop the unused books table (uncomment if you want to clean up)
-- DROP TABLE IF EXISTS books CASCADE;
