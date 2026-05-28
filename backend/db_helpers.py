"""
PostgreSQL helper functions using asyncpg.
Drop-in pattern to replace supabase.table() calls.

Usage:
    pool = await get_pool()

    # SELECT multiple rows
    rows = await db_fetch(pool, "SELECT * FROM profiles WHERE user_id = $1", user_id)
    # rows is a list of Record objects, access like: rows[0]['column_name']

    # SELECT single row
    row = await db_fetchrow(pool, "SELECT * FROM course_books WHERE id = $1", book_id)
    # row is a Record or None, access like: row['column_name']

    # INSERT returning row
    row = await db_fetchrow(pool, "INSERT INTO profiles (id, email) VALUES ($1, $2) RETURNING *", id, email)

    # UPDATE
    await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "processing", book_id)

    # DELETE
    await db_execute(pool, "DELETE FROM review_queue WHERE id = $1", id)

    # Single value
    count = await db_fetchval(pool, "SELECT COUNT(*) FROM paragraphs WHERE chapter_id = $1", chapter_id)
"""

import asyncpg
from db import get_pool


async def db_fetch(pool, sql: str, *args) -> list:
    """Execute a SELECT query and return all rows as a list."""
    async with pool.acquire() as conn:
        return await conn.fetch(sql, *args)


async def db_fetchrow(pool, sql: str, *args):
    """Execute a SELECT query and return a single row (or None)."""
    async with pool.acquire() as conn:
        return await conn.fetchrow(sql, *args)


async def db_execute(pool, sql: str, *args):
    """Execute an INSERT/UPDATE/DELETE query."""
    async with pool.acquire() as conn:
        return await conn.execute(sql, *args)


async def db_fetchval(pool, sql: str, *args):
    """Execute a query and return a single scalar value."""
    async with pool.acquire() as conn:
        return await conn.fetchval(sql, *args)


def record_to_dict(record) -> dict:
    """Convert an asyncpg Record to a plain dict."""
    if record is None:
        return None
    return dict(record)


def records_to_list(records) -> list:
    """Convert a list of asyncpg Records to a list of dicts."""
    return [dict(r) for r in records]
