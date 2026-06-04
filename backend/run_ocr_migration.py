"""
One-shot script to create the OCR tables on your RDS database.
Run: python run_ocr_migration.py
"""
import asyncio
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from db import get_pool

SQL = """
CREATE TABLE IF NOT EXISTS ocr_books (
    id            SERIAL PRIMARY KEY,
    user_id       UUID         NOT NULL,
    title         VARCHAR(500) NOT NULL,
    filename      VARCHAR(500),
    total_pages   INTEGER      DEFAULT 0,
    status        VARCHAR(50)  DEFAULT 'processing',
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
"""

async def main():
    print("Connecting to RDS...")
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(SQL)
    print("✅ OCR tables created (or already existed).")

if __name__ == "__main__":
    asyncio.run(main())
