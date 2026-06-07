"""
REST API endpoints that proxy data operations to PostgreSQL (RDS via asyncpg).
Replaces direct Supabase client calls from the frontend.
"""

import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

from db import get_pool
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from services.s3_service import upload_file_to_s3

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CourseCreate(BaseModel):
    user_id: str
    name: str
    color: Optional[str] = None
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None


class BookCreate(BaseModel):
    subject_id: str
    user_id: str
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    file_url: Optional[str] = None
    cover_url: Optional[str] = None
    analogy_topic: Optional[str] = None
    total_pages: Optional[int] = None
    status: Optional[str] = "pending"


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    file_url: Optional[str] = None
    cover_url: Optional[str] = None
    analogy_topic: Optional[str] = None
    total_pages: Optional[int] = None
    status: Optional[str] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    interests: Optional[str] = None
    email: Optional[str] = None


class ChatLogCreate(BaseModel):
    user_id: str
    chapter_id: str
    role: str
    content: str


class UserProgressUpsert(BaseModel):
    user_id: str
    book_id: str
    current_block_id: str


# ---------------------------------------------------------------------------
# COURSES (subjects)
# ---------------------------------------------------------------------------

@router.get("/courses")
async def get_courses(user_id: str):
    """Return all courses for a user, each with a nested course_books array."""
    pool = await get_pool()

    courses = await db_fetch(
        pool,
        "SELECT * FROM courses WHERE user_id = $1 ORDER BY created_at ASC",
        user_id,
    )
    if not courses:
        return []

    course_ids = [str(row["id"]) for row in courses]

    books = await db_fetch(
        pool,
        "SELECT * FROM course_books WHERE subject_id = ANY($1::uuid[])",
        course_ids,
    )

    # Group books by subject_id
    books_by_course: dict[str, list] = {}
    for book in books:
        sid = str(book["subject_id"])
        books_by_course.setdefault(sid, []).append(dict(book))

    result = []
    for course in courses:
        d = dict(course)
        d["course_books"] = books_by_course.get(str(course["id"]), [])
        result.append(d)

    return result


@router.post("/courses", status_code=201)
async def create_course(body: CourseCreate):
    """Create a new course (subject)."""
    pool = await get_pool()

    row = await db_fetchrow(
        pool,
        """
        INSERT INTO courses (user_id, name, color, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        body.user_id,
        body.name,
        body.color,
        body.description,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create course")
    return dict(row)


@router.put("/courses/{course_id}")
async def update_course(course_id: str, body: CourseUpdate):
    """Update a course's name, color, or description."""
    pool = await get_pool()

    # Build a dynamic SET clause from provided fields
    fields = {}
    if body.name is not None:
        fields["name"] = body.name
    if body.color is not None:
        fields["color"] = body.color
    if body.description is not None:
        fields["description"] = body.description

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(fields))
    values = list(fields.values())

    row = await db_fetchrow(
        pool,
        f"UPDATE courses SET {set_clause} WHERE id = $1 RETURNING *",
        course_id,
        *values,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Course not found")
    return dict(row)


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    """Delete a course."""
    pool = await get_pool()
    await db_execute(pool, "DELETE FROM courses WHERE id = $1", course_id)
    return {"success": True}


# ---------------------------------------------------------------------------
# COURSE BOOKS
# ---------------------------------------------------------------------------

@router.get("/books/{book_id}")
async def get_book(book_id: str):
    """Return a single book by id."""
    pool = await get_pool()
    row = await db_fetchrow(pool, "SELECT * FROM course_books WHERE id = $1", book_id)
    if not row:
        raise HTTPException(status_code=404, detail="Book not found")
    return dict(row)


@router.post("/books", status_code=201)
async def create_book(body: BookCreate):
    """Create a new book inside a course."""
    pool = await get_pool()

    row = await db_fetchrow(
        pool,
        """
        INSERT INTO course_books
            (subject_id, user_id, title, author, description,
             file_url, cover_url, analogy_topic, total_pages, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        """,
        body.subject_id,
        body.user_id,
        body.title,
        body.author,
        body.description,
        body.file_url,
        body.cover_url,
        body.analogy_topic,
        body.total_pages,
        body.status,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create book")
    return dict(row)


@router.put("/books/{book_id}")
async def update_book(book_id: str, body: BookUpdate):
    """Update any fields on a book."""
    pool = await get_pool()

    fields = {}
    if body.title is not None:
        fields["title"] = body.title
    if body.author is not None:
        fields["author"] = body.author
    if body.description is not None:
        fields["description"] = body.description
    if body.file_url is not None:
        fields["file_url"] = body.file_url
    if body.cover_url is not None:
        fields["cover_url"] = body.cover_url
    if body.analogy_topic is not None:
        fields["analogy_topic"] = body.analogy_topic
    if body.total_pages is not None:
        fields["total_pages"] = body.total_pages
    if body.status is not None:
        fields["status"] = body.status

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(fields))
    values = list(fields.values())

    row = await db_fetchrow(
        pool,
        f"UPDATE course_books SET {set_clause} WHERE id = $1 RETURNING *",
        book_id,
        *values,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Book not found")
    return dict(row)


@router.delete("/books/{book_id}")
async def delete_book(book_id: str):
    """Delete a book and all dependent data."""
    pool = await get_pool()
    await db_execute(pool, "DELETE FROM chat_logs WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = $1)", book_id)
    await db_execute(pool, "DELETE FROM paragraphs WHERE chapter_id IN (SELECT id FROM chapters WHERE book_id = $1)", book_id)
    await db_execute(pool, "DELETE FROM chapters WHERE book_id = $1", book_id)
    await db_execute(pool, "DELETE FROM course_books WHERE id = $1", book_id)
    return {"success": True}


# ---------------------------------------------------------------------------
# PROFILE
# ---------------------------------------------------------------------------

@router.get("/profile/{user_id}")
async def get_profile(user_id: str):
    """Return a user's profile."""
    pool = await get_pool()
    row = await db_fetchrow(pool, "SELECT * FROM profiles WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dict(row)


@router.put("/profile/{user_id}")
async def upsert_profile(user_id: str, body: ProfileUpdate):
    """Upsert a user profile (full_name, interests, email)."""
    pool = await get_pool()

    row = await db_fetchrow(
        pool,
        """
        INSERT INTO profiles (id, full_name, interests, email)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE
            SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
                interests  = COALESCE(EXCLUDED.interests,  profiles.interests),
                email      = COALESCE(EXCLUDED.email,      profiles.email)
        RETURNING *
        """,
        user_id,
        body.full_name,
        body.interests,
        body.email,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to upsert profile")
    return dict(row)


# ---------------------------------------------------------------------------
# CHAT LOGS
# ---------------------------------------------------------------------------

@router.post("/chat-logs", status_code=201)
async def create_chat_log(body: ChatLogCreate):
    """Insert a chat log entry."""
    pool = await get_pool()

    row = await db_fetchrow(
        pool,
        """
        INSERT INTO chat_logs (user_id, chapter_id, role, content)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        body.user_id,
        body.chapter_id,
        body.role,
        body.content,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to save chat log")
    return dict(row)


@router.get("/chat-logs/{chapter_id}/{user_id}")
async def get_chat_history(chapter_id: str, user_id: str):
    """Return chat history for a chapter and user, ordered by creation time."""
    pool = await get_pool()

    rows = await db_fetch(
        pool,
        """
        SELECT * FROM chat_logs
        WHERE chapter_id = $1 AND user_id = $2
        ORDER BY created_at ASC
        """,
        chapter_id,
        user_id,
    )
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# USER PROGRESS
# ---------------------------------------------------------------------------

@router.post("/user-progress")
async def upsert_user_progress(body: UserProgressUpsert):
    """Upsert the user's current reading position for a book."""
    pool = await get_pool()

    row = await db_fetchrow(
        pool,
        """
        INSERT INTO user_progress (user_id, book_id, current_block_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, book_id) DO UPDATE
            SET current_block_id = EXCLUDED.current_block_id,
                updated_at = NOW()
        RETURNING *
        """,
        body.user_id,
        body.book_id,
        body.current_block_id,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to upsert user progress")
    return dict(row)

@router.get("/user-progress/completed/{book_id}/{user_id}")
async def get_completed_blocks(book_id: str, user_id: str):
    """Get a list of completed block IDs for a user in a book."""
    pool = await get_pool()
    rows = await db_fetch(
        pool, 
        "SELECT current_block_id FROM user_progress WHERE user_id = $1 AND book_id = $2 AND is_completed = TRUE", 
        user_id, book_id
    )
    return [str(r["current_block_id"]) for r in rows]

@router.get("/book-progress/{book_id}/{user_id}")
async def get_book_progress(book_id: str, user_id: str):
    """Get total paragraphs and completed paragraphs for a book and user."""
    pool = await get_pool()
    total = await db_fetchval(
        pool, 
        "SELECT COUNT(*) FROM paragraphs p JOIN chapters c ON p.chapter_id = c.id WHERE c.book_id = $1", 
        book_id
    )
    completed = await db_fetchval(
        pool, 
        "SELECT COUNT(*) FROM user_progress WHERE book_id = $1 AND user_id = $2 AND is_completed = TRUE", 
        book_id, user_id
    )
    return {"total": total or 0, "completed": completed or 0}


# ---------------------------------------------------------------------------
# PARAGRAPHS
# ---------------------------------------------------------------------------

@router.get("/paragraphs/{chapter_id}")
async def get_paragraphs(chapter_id: str):
    """Return all paragraphs (content blocks) for a chapter, ordered."""
    pool = await get_pool()

    rows = await db_fetch(
        pool,
        "SELECT * FROM paragraphs WHERE chapter_id = $1 ORDER BY order_index ASC",
        chapter_id,
    )
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# CHAPTERS
# ---------------------------------------------------------------------------

@router.get("/chapters/{book_id}")
async def get_chapters(book_id: str):
    """Return all chapters for a book, ordered by order_index."""
    pool = await get_pool()

    rows = await db_fetch(
        pool,
        "SELECT * FROM chapters WHERE book_id = $1 ORDER BY order_index ASC",
        book_id,
    )
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# STUDY SESSIONS
# ---------------------------------------------------------------------------

@router.delete("/study-sessions/book/{book_id}")
async def delete_study_sessions_for_book(book_id: str):
    """Delete all study sessions associated with a book."""
    pool = await get_pool()
    await db_execute(pool, "DELETE FROM study_sessions WHERE book_id = $1", book_id)
    return {"success": True}


# ---------------------------------------------------------------------------
# PDF UPLOAD TO S3
# ---------------------------------------------------------------------------

@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """
    Accept a PDF upload, store it in S3, and return the CloudFront URL.
    The file is stored at: pdfs/{user_id}/{filename}
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Read file bytes
    try:
        file_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read file: {exc}")

    s3_key = f"pdfs/{user_id}/{file.filename}"
    content_type = file.content_type or "application/pdf"

    try:
        file_url = await asyncio.to_thread(
            upload_file_to_s3, file_bytes, s3_key, content_type
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {exc}")

    return {"file_url": file_url}
