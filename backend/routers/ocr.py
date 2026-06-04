"""
OCR router — book upload, progress polling, and result retrieval.

Tables required (see migrations/create_ocr_tables.sql):
  ocr_books(id, user_id, title, filename, total_pages, status, error_message, created_at)
  ocr_chapters(id, book_id, chapter_number, chapter_title, content, page_start, page_end)
"""

import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form

from db import get_pool
from db_helpers import db_fetch, db_fetchrow, db_execute
from services.glm_ocr_service import pdf_to_images, ocr_image_roboflow, detect_chapters

router = APIRouter()

# In-memory job tracker {job_id: {percent, page, total, status, book_id, error}}
_jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Upload + process
# ---------------------------------------------------------------------------

@router.post("/ocr/upload")
async def upload_book(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...),
    title: str = Form(""),
):
    """
    Accept a PDF upload, create an ocr_books row with status='processing',
    and kick off background OCR.  Returns {job_id, book_id}.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    book_title = title.strip() or file.filename.rsplit(".", 1)[0]

    pool = await get_pool()

    row = await db_fetchrow(
        pool,
        """
        INSERT INTO ocr_books (user_id, title, filename, status)
        VALUES ($1, $2, $3, 'processing')
        RETURNING id
        """,
        user_id,
        book_title,
        file.filename,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create book record.")

    book_id = row["id"]
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "percent": 0,
        "page": 0,
        "total": 0,
        "status": "processing",
        "book_id": book_id,
    }

    background_tasks.add_task(_process_book, job_id, book_id, pdf_bytes)

    return {"job_id": job_id, "book_id": book_id}


async def _process_book(job_id: str, book_id: int, pdf_bytes: bytes):
    """Background task: convert PDF pages to images, OCR each, then save chapters."""
    pool = await get_pool()
    job = _jobs[job_id]

    try:
        images = pdf_to_images(pdf_bytes)
        total = len(images)
        job["total"] = total

        await db_execute(
            pool,
            "UPDATE ocr_books SET total_pages = $1 WHERE id = $2",
            total,
            book_id,
        )

        pages_text: list[str] = []
        for i, img_bytes in enumerate(images):
            text = await ocr_image_roboflow(img_bytes)
            pages_text.append(text)
            job["page"] = i + 1
            job["percent"] = int(((i + 1) / total) * 90)  # 90% for OCR, 10% for save

        chapters = detect_chapters(pages_text)

        for ch in chapters:
            await db_execute(
                pool,
                """
                INSERT INTO ocr_chapters
                  (book_id, chapter_number, chapter_title, content, page_start, page_end)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                book_id,
                ch["number"],
                ch["title"],
                ch["content"],
                ch.get("page_start"),
                ch.get("page_end"),
            )

        await db_execute(
            pool,
            "UPDATE ocr_books SET status = 'completed', updated_at = NOW() WHERE id = $1",
            book_id,
        )

        job["percent"] = 100
        job["status"] = "completed"

    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
        await db_execute(
            pool,
            "UPDATE ocr_books SET status = 'failed', error_message = $1 WHERE id = $2",
            str(exc)[:500],
            book_id,
        )


# ---------------------------------------------------------------------------
# Progress polling
# ---------------------------------------------------------------------------

@router.get("/ocr/progress/{job_id}")
async def get_progress(job_id: str):
    """Poll for OCR job progress. Returns percent, status, and book_id when done."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "percent": job["percent"],
        "page": job.get("page", 0),
        "total": job.get("total", 0),
        "status": job["status"],
        "book_id": job.get("book_id"),
        "error": job.get("error"),
    }


# ---------------------------------------------------------------------------
# Book listing and retrieval
# ---------------------------------------------------------------------------

@router.get("/ocr/books")
async def list_books(user_id: str):
    """Return all OCR books for the given user, newest first."""
    pool = await get_pool()
    rows = await db_fetch(
        pool,
        """
        SELECT id, title, filename, total_pages, status, created_at
        FROM ocr_books
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_id,
    )
    return [dict(r) for r in rows]


@router.get("/ocr/books/{book_id}")
async def get_book(book_id: int, user_id: str):
    """Return a single OCR book with all its chapters."""
    pool = await get_pool()

    book = await db_fetchrow(
        pool,
        "SELECT * FROM ocr_books WHERE id = $1 AND user_id = $2",
        book_id,
        user_id,
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")

    chapters = await db_fetch(
        pool,
        """
        SELECT id, chapter_number, chapter_title, content, page_start, page_end
        FROM ocr_chapters
        WHERE book_id = $1
        ORDER BY chapter_number ASC
        """,
        book_id,
    )

    result = dict(book)
    result["chapters"] = [dict(c) for c in chapters]
    return result


@router.delete("/ocr/books/{book_id}")
async def delete_book(book_id: int, user_id: str):
    """Delete an OCR book and its chapters (via CASCADE)."""
    pool = await get_pool()
    await db_execute(
        pool,
        "DELETE FROM ocr_books WHERE id = $1 AND user_id = $2",
        book_id,
        user_id,
    )
    return {"success": True}
