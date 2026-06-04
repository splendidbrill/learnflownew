-- Run this migration against your RDS PostgreSQL database to enable the OCR feature.
-- psql -h <RDS_HOST> -U postgres -d learnflow -f create_ocr_tables.sql

CREATE TABLE IF NOT EXISTS ocr_books (
    id            SERIAL PRIMARY KEY,
    user_id       UUID         NOT NULL,
    title         VARCHAR(500) NOT NULL,
    filename      VARCHAR(500),
    total_pages   INTEGER      DEFAULT 0,
    status        VARCHAR(50)  DEFAULT 'processing',  -- processing | completed | failed
    error_message TEXT,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ocr_chapters (
    id              SERIAL PRIMARY KEY,
    book_id         INTEGER      NOT NULL REFERENCES ocr_books(id) ON DELETE CASCADE,
    chapter_number  INTEGER      NOT NULL,
    chapter_title   VARCHAR(500),
    content         TEXT,
    page_start      INTEGER,
    page_end        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ocr_books_user_id    ON ocr_books(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_chapters_book_id ON ocr_chapters(book_id);
