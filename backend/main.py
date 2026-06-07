import os
import fitz # PyMuPDF
import re
import io
import json
import hashlib
import httpx
import pdfplumber

from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.responses import FileResponse
from services.tts_service import generate_audio
from typing import List, Optional
import asyncio
import html
from PIL import Image

# --- IMPORTS ---
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from db import supabase, get_db, get_pool
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from services.vision_service import analyze_diagram, describe_image, is_valid_diagram
from services.mermaid_service import generate_concept_diagram, personalize_image_explanation
from services.s3_service import upload_file_to_s3, get_cloudfront_url
from routers import scheduler, stats, admin, subscription, rate_limits, payment, contact, data, ocr

# 1. Load Env
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# 2. Setup Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scheduler.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(subscription.router, prefix="/api")
app.include_router(rate_limits.router, prefix="/api")
app.include_router(payment.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(data.router, prefix="/api")
app.include_router(ocr.router, prefix="/api")

# --- 3. SETUP TEXT BRAIN (DeepSeek via Azure) ---
text_base_url = os.getenv("AZURE_TEXT_BASE_URL")
text_api_key = os.getenv("AZURE_TEXT_API_KEY")
text_model_name = os.getenv("AZURE_TEXT_MODEL")

try:
    llm = ChatOpenAI(
        model=text_model_name,
        api_key=text_api_key,
        base_url=text_base_url,
        temperature=0.1,
    )
    print(f"✅ Text LLM Initialized: {text_model_name}")
except Exception as e:
    print(f"❌ Failed to initialize Text LLM: {e}")

# --- STARTUP HOOK (TELEGRAM) ---
@app.on_event("startup")
async def set_telegram_webhook():
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    app_url = os.getenv("APP_URL")
    if not bot_token or not app_url: return

    webhook_url = f"{app_url}/api/hooks/telegram"
    async with httpx.AsyncClient() as client:
        try:
            await client.post(f"https://api.telegram.org/bot{bot_token}/setWebhook", params={"url": webhook_url})
        except: pass

# --- STARTUP HOOK (OCR TABLES) ---
@app.on_event("startup")
async def create_ocr_tables():
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
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
            """)
        print("✅ OCR tables ready")
    except Exception as e:
        print(f"⚠️  OCR table creation skipped: {e}")

# --- MODELS ---
# Example - your file should have something like this:
class ChatRequest(BaseModel):
    message: str
    # ... other fields

class TTSRequest(BaseModel):
    text: str
    language: str = "english"

class IngestRequest(BaseModel):
    bookId: str
    fileUrl: str
    interest: str
    bookType: str

class GenerateChapterRequest(BaseModel):
    chapterId: str

class ImageAnalysisRequest(BaseModel):
    paragraphId: str
    imageUrl: str
    analogyTopic: str
    context: str = "General Topic" # Context passed from Frontend

class ChatRequest(BaseModel):
    messages: list
    chapterId: str
    userId: str
    bookId: str
    currentParagraphId: str | None = None
    userResponse: str = ""

class PatternRequest(BaseModel):
    completedBlockIds: list[str]

class MermaidRequest(BaseModel):
    content: str
    diagram_type: str = "flowchart"  # flowchart, mindmap, sequence, timeline
    chapterId: str | None = None

# --- ENDPOINTS ---

# 📊 MERMAID DIAGRAM GENERATION
def clean_math_text(text: str) -> str:
    """Clean OCR output: decode HTML entities + convert ^ to superscripts."""
    if not text:
        return text

    # Decode HTML entities
    text = html.unescape(text)

    # Convert ^ notation to Unicode superscripts
    superscripts = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
        'n': 'ⁿ'
    }

    def replace_superscript(match):
        char = match.group(1)
        return superscripts.get(char, f'^{char}')

    text = re.sub(r'\^([0-9n+\-=()])', replace_superscript, text)

    return text

async def ocr_worker(img_bytes, idx):
    async with sem:
        result = await extract_text_with_mistral(img_bytes, domain=book_domain)
        result = clean_math_text(result)  # <-- Just call it here
        # ...
        return result


def extract_chapter_number(title: str) -> Optional[int]:
    match = re.search(r'chapter\s*(\d+)', title, re.IGNORECASE)
    if match:
        return int(match.group(1))
    match = re.search(r'^(\d+)[\s:.\-]', title.strip())
    if match:
        return int(match.group(1))
    return None

def generate_title_variants(title: str) -> List[str]:
    """Generate search patterns for various title formats."""
    variants = [title.lower()]

    # Without chapter number prefix
    clean_title = re.sub(r'^(chapter|unit|part)\s*\d+[:\s\-]*', '', title, flags=re.IGNORECASE).strip()
    if clean_title and clean_title.lower() not in variants:
        variants.append(clean_title.lower())

    # Without punctuation
    no_punct = re.sub(r'[^\w\s]', '', title.lower())
    if no_punct not in variants:
        variants.append(no_punct)

    # Chapter number variants
    ch_num = extract_chapter_number(title)
    if ch_num:
        variants.extend([
            f"chapter {ch_num}",
            f"chapter{ch_num}",
            f"ch {ch_num}",
            f"ch.{ch_num}",
            f"unit {ch_num}",
            f"part {ch_num}",
        ])

    return [v for v in variants if len(v) > 2]


def find_chapter_start_robust(doc, chapter_title: str, chapter_number: Optional[int],
                               expected_page: int, search_range: int = 40) -> int:
    """
    Robust chapter start detection using multiple strategies.
    Returns 0-indexed page number.
    """
    title_variants = generate_title_variants(chapter_title)

    # Search in expanding circles from expected page
    search_start = max(0, expected_page - search_range)
    search_end = min(len(doc), expected_page + search_range)

    # Strategy scores
    candidates = []

    for page_idx in range(search_start, search_end):
        page = doc[page_idx]
        blocks = page.get_text("dict")["blocks"]
        page_text = page.get_text()
        page_text_lower = page_text.lower()

        best_score = 0
        best_match = ""

        for b in blocks:
            if b["type"] != 0:
                continue

            for line in b["lines"]:
                line_text = " ".join([s["text"] for s in line["spans"]])
                max_size = max([s["size"] for s in line["spans"]])
                line_lower = line_text.lower()

                # Score based on multiple factors
                score = 0

                # Factor 1: Large font (chapter headers are usually 20pt+)
                if max_size > 40:
                    score += 50
                elif max_size > 30:
                    score += 30
                elif max_size > 20:
                    score += 15

                # Factor 2: Chapter number match
                if chapter_number is not None:
                    nums = re.findall(r'\d+', line_text)
                    if nums and int(nums[0]) == chapter_number:
                        score += 40
                        # Bonus for standalone number
                        if len(nums) == 1 and len(line_text.strip()) < 10:
                            score += 30

                # Factor 3: Title match
                for variant in title_variants:
                    if variant in line_lower:
                        # Exact match bonus
                        if line_lower.strip() == variant.strip():
                            score += 30
                        else:
                            score += 15
                        break

                # Factor 4: Position on page (headers are at top)
                # Get y-position of this line
                y_pos = line["bbox"][1]  # Top y-coordinate
                page_height = page.rect.height
                if y_pos < page_height * 0.3:  # Top 30% of page
                    score += 10

                # Factor 5: Clean line (headers are usually short)
                if len(line_text.strip()) < 60:
                    score += 5

                # Factor 6: Chapter keyword
                if "chapter" in line_lower or "unit" in line_lower or "part" in line_lower:
                    score += 10

                if score > best_score:
                    best_score = score
                    best_match = line_text[:50]

        if best_score > 50:  # Threshold for potential match
            # Distance penalty (prefer pages closer to expected)
            distance = abs(page_idx - expected_page)
            adjusted_score = best_score - distance * 0.5
            candidates.append((page_idx, adjusted_score, best_match))

    if candidates:
        # Sort by score
        candidates.sort(key=lambda x: x[1], reverse=True)
        best_page, best_score, best_match = candidates[0]
        print(f"   Found at page {best_page + 1} (score: {best_score:.0f}): '{best_match}...'")
        return best_page

    # Fallback: Search for title in text
    print(f"   Fallback: Searching for title in text...")
    for page_idx in range(search_start, search_end):
        page_text = doc[page_idx].get_text().lower()
        for variant in title_variants:
            if len(variant) > 5 and variant in page_text:
                print(f"   Found title variant in text at page {page_idx + 1}")
                return page_idx

    # Last resort: return expected page
    print(f"   Could not find chapter start, using expected page {expected_page + 1}")
    return expected_page

def find_chapter_end_robust(doc, chapter_start: int, chapter_title: str,
                            chapter_number: Optional[int], next_chapter_start: Optional[int] = None) -> int:
    """
    Find chapter end using multiple strategies.
    Returns 0-indexed page number (exclusive).
    """
    # Strategy 1: Use next chapter start if provided
    if next_chapter_start is not None and next_chapter_start > chapter_start:
        # Validate that next_chapter_start doesn't have current chapter content
        next_page_text = doc[next_chapter_start].get_text().lower()

        # Check if this looks like next chapter
        next_ch_num = chapter_number + 1 if chapter_number else None
        if next_ch_num:
            if f"chapter {next_ch_num}" in next_page_text or f"chapter{next_ch_num}" in next_page_text:
                print(f"   End: Next chapter confirmed at page {next_chapter_start + 1}")
                return next_chapter_start

        # Even without confirmation, trust it
        return next_chapter_start

    # Strategy 2: Search for end-of-chapter markers
    print("   Searching for chapter end markers...")

    end_markers = [
        "what you have learnt",
        "exercises",
        "summary",
        "review questions",
        "key terms",
        "chapter review",
        "problems",
        "practice questions",
    ]

    for page_idx in range(chapter_start + 3, min(chapter_start + 50, len(doc))):
        page_text = doc[page_idx].get_text().lower()

        # Check for end markers
        marker_count = sum(1 for marker in end_markers if marker in page_text)

        if marker_count >= 2:
            # Check if next page starts a new chapter
            if page_idx + 1 < len(doc):
                next_text = doc[page_idx + 1].get_text().lower()

                # Look for chapter indicators
                if re.search(r'chapter\s*\d+', next_text[:500]):
                    print(f"   End: Found exercises + next chapter indicator at page {page_idx + 1}")
                    return page_idx + 1

                # Look for large font at top of next page (new section/chapter)
                next_blocks = doc[page_idx + 1].get_text("dict")["blocks"]
                for b in next_blocks:
                    if b["type"] == 0:
                        for line in b["lines"]:
                            max_size = max([s["size"] for s in line["spans"]])
                            if max_size > 30:
                                print(f"   End: Found next chapter header at page {page_idx + 2}")
                                return page_idx + 1

            # This page has end markers, likely chapter ends here or next
            print(f"   End: Found end markers at page {page_idx + 1}")
            return page_idx + 1

    # Strategy 3: Search for next chapter number
    if chapter_number is not None:
        next_ch_num = chapter_number + 1
        for page_idx in range(chapter_start + 5, min(chapter_start + 60, len(doc))):
            page_text = doc[page_idx].get_text().lower()

            # Look for next chapter number
            patterns = [f"chapter {next_ch_num}", f"chapter{next_ch_num}", f"ch {next_ch_num}"]
            for pattern in patterns:
                if pattern in page_text[:1000]:  # Check first part of page
                    # Verify it's a header, not a reference
                    blocks = doc[page_idx].get_text("dict")["blocks"]
                    for b in blocks:
                        if b["type"] == 0:
                            for line in b["lines"]:
                                line_text = " ".join([s["text"] for s in line["spans"]]).lower()
                                max_size = max([s["size"] for s in line["spans"]])
                                if pattern in line_text and max_size > 20:
                                    print(f"   End: Found Chapter {next_ch_num} at page {page_idx + 1}")
                                    return page_idx

    # Fallback: Return a reasonable range (20 pages)
    return min(chapter_start + 20, len(doc))


def validate_chapter_content(page_texts: List[str], chapter_title: str,
                             chapter_number: Optional[int]) -> tuple[int, int]:
    """
    Validate and adjust chapter boundaries after OCR.
    Returns (start_page_idx, end_page_idx) to keep.
    """
    if not page_texts:
        return (0, 0)

    # Check first 2 pages for previous chapter overlap
    start_idx = 0
    prev_ch_num = chapter_number - 1 if chapter_number and chapter_number > 1 else None

    for i in range(min(2, len(page_texts))):
        text = (page_texts[i] or "").lower()

        if prev_ch_num:
            # Check for previous chapter end markers
            has_exercises = "exercises" in text[-600:] if len(text) > 600 else "exercises" in text
            has_prev_ch = f"chapter {prev_ch_num}" in text
            has_summary = "what you have learnt" in text or "summary" in text

            # Only skip if strong indicators
            if (has_exercises or has_summary) and has_prev_ch:
                print(f"   Skipping page {i}: previous chapter content")
                start_idx = i + 1

    # Check last pages for next chapter start (if we have many pages)
    end_idx = len(page_texts)
    if len(page_texts) > 5 and chapter_number:
        next_ch_num = chapter_number + 1
        for i in range(len(page_texts) - 1, max(start_idx + 3, len(page_texts) - 4), -1):
            text = (page_texts[i] or "").lower()

            # Check for next chapter start
            if f"chapter {next_ch_num}" in text[:500]:
                # Check if it's a header or reference
                if "in chapter" not in text[:500]:  # Not a reference
                    print(f"   Trimming page {i}: next chapter start detected")
                    end_idx = i
                    break

    return (start_idx, end_idx)


@app.post("/api/generate-diagram")
async def generate_diagram_endpoint(req: MermaidRequest):
    """Generate a Mermaid.js diagram from educational content"""
    print(f"📊 Generating {req.diagram_type} diagram...")

    result = generate_concept_diagram(req.content, req.diagram_type)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate diagram"))

    return result

# 🧠 A. MATH PATTERN RECOGNITION
@app.post("/api/detect-pattern")
async def detect_pattern_endpoint(req: PatternRequest):
    if len(req.completedBlockIds) < 2:
        return {"found": False, "message": "Need more examples."}

    # Fetch content
    pool = await get_pool()
    placeholders = ", ".join(f"${i+1}" for i in range(len(req.completedBlockIds)))
    blocks = await db_fetch(pool, f"SELECT content FROM paragraphs WHERE id = ANY($1::uuid[])", req.completedBlockIds)

    # Filter for "Examples" based on text keywords (since DB type is just 'text')
    examples = []
    for b in blocks:
        text_lower = b['content'].lower()
        if any(x in text_lower for x in ["example", "solution", "problem", "calculate"]):
            examples.append(b)

    if len(examples) < 2:
        return {"found": False, "message": "No pattern detected yet."}

    # Ask DeepSeek
    combined_text = "\n---\n".join([ex['content'] for ex in examples])
    prompt = f"""
    You are a Math Pattern Engine. Here are {len(examples)} example solutions:
    {combined_text}

    TASK:
    1. Identify the common formula or heuristic used.
    2. Extract it as a general tool.

    OUTPUT JSON ONLY:
    {{
        "pattern_name": "Name of the concept",
        "formula": "LaTeX formula",
        "strategy": "One sentence strategy."
    }}
    """
    try:
        ai_res = await llm.ainvoke([HumanMessage(content=prompt)])
        clean_json = ai_res.content.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
        return {"found": True, "data": data}
    except Exception as e:
        print(f"Pattern Error: {e}")
        return {"found": False}

# 👁️ B. DIAGRAM EXPLAINER (Two-Stage Caching)
@app.post("/api/analyze-image")
async def analyze_image_endpoint(req: ImageAnalysisRequest):
    print(f"👁️ Analyze Request | Context: {req.context} | Interest: {req.analogyTopic}")

    pool = await get_pool()

    # Step 1: Check if we already have a personalized explanation for this user's interest
    existing = await db_fetchrow(pool, "SELECT explanation, image_description, analogy_topic FROM paragraphs WHERE id = $1", req.paragraphId)

    # If we have a cached explanation with the SAME interest, return it
    if existing and existing.get("explanation"):
        cached_topic = existing.get("analogy_topic", "")
        if cached_topic.lower() == req.analogyTopic.lower():
            print(f"✅ Returning cached explanation (same interest)")
            return {"explanation": existing["explanation"]}

    # Step 2: Check if we have a cached IMAGE DESCRIPTION (the expensive part)
    image_description = existing.get("image_description") if existing else None

    if not image_description:
        # No cached description - call Vision API ONCE to describe the image
        print(f"🔍 No cached description. Calling Vision API...")
        image_description = await describe_image(req.imageUrl, req.context)

        # Cache the description for future users
        if "Error" not in image_description:
            await db_execute(pool, "UPDATE paragraphs SET image_description = $1 WHERE id = $2", image_description, req.paragraphId)
            print(f"💾 Cached image description")
    else:
        print(f"✅ Using cached image description")

    # Step 3: Personalize with user's interest using DeepSeek (cheap!)
    print(f"🎨 Personalizing with interest: {req.analogyTopic}")
    explanation = personalize_image_explanation(image_description, req.analogyTopic, req.context)

    # Save the personalized explanation
    if "Error" not in explanation:
        await db_execute(pool, "UPDATE paragraphs SET explanation = $1, analogy_topic = $2 WHERE id = $3", explanation, req.analogyTopic, req.paragraphId)

    return {"explanation": explanation}


# --- D. AGENTIC EXPLANATION (Optimized) ---
class AgenticExplanationRequest(BaseModel):
    paragraph_id: str | None = None
    content: str
    user_interest: str
    context: str = ""
    difficulty_level: str = "medium"

@app.post("/api/explain-agentic")
async def explain_agentic_endpoint(req: AgenticExplanationRequest):
    print(f"🤖 Agentic Explanation Request: {req.user_interest}")

    # Lazy import to avoid circular dependencies
    from services.agent_graph import generate_agentic_explanation

    explanation_data = await generate_agentic_explanation(
        content=req.content,
        user_interest=req.user_interest,
        context=req.context,
        difficulty_level=req.difficulty_level
    )

    # Optionally save to DB if paragraphId provided
    if req.paragraph_id and explanation_data.get("explanation"):
        try:
             # We let frontend handle the saving to 'chat_logs', but we can also update 'paragraphs' if needed
             # For now, just return the data as the frontend seems to handle saving
             pass
        except: pass

    return explanation_data

# 💬 C. CHAT & PROGRESS
# Replace the existing /chat endpoint in main.py

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    system_context = "You are a helpful AI Tutor."

    pool = await get_pool()

    # 1. Fetch Book-Specific Interest from DB
    user_interest = "general" # Default
    try:
        if req.bookId:
            book_res = await db_fetchrow(pool, "SELECT analogy_topic FROM course_books WHERE id = $1", req.bookId)
            if book_res and book_res.get('analogy_topic'):
                fetched = book_res['analogy_topic'].strip()
                if fetched: user_interest = fetched
    except Exception as e:
        print(f"⚠️ Could not fetch book interest: {e}")

    print(f"💬 Chat Context: {user_interest}") # Debug print to console

    # 2. Build Context based on Paragraph
    if req.currentParagraphId:
        try:
            para_res = await db_fetchrow(pool, "SELECT content, section_title FROM paragraphs WHERE id = $1", req.currentParagraphId)

            if para_res:
                para_content = para_res['content']
                section_title = para_res.get('section_title', 'General Section')

                # --- STRONGER PROMPT ---
                system_context = f"""
                You are an expert AI Tutor.

                CURRENT CONTEXT:
                - Section: {section_title}
                - Content: "{para_content}"
                - Student's Interest: **{user_interest}** (STRICTLY USE THIS)

                INSTRUCTIONS:
                1. Explain the content clearly.
                2. **MANDATORY**: You MUST use an analogy related to '{user_interest}'.
                   - If '{user_interest}' is Cooking -> Use recipes, ingredients, chefs, kitchen.
                   - If '{user_interest}' is Football -> Use goals, players, matches.
                3. If the user says "Next" or "Got it", reply ONLY: "[NEXT]"
                """
        except Exception as e:
            print(f"⚠️ Paragraph Context Error: {e}")

    # 3. Stream Response
    langchain_messages = [SystemMessage(content=system_context)]
    for msg in req.messages:
        if msg.get('role') == 'user':
            langchain_messages.append(HumanMessage(content=msg.get('content')))

    async def response_generator():
        full_response = ""
        try:
            async for chunk in llm.astream(langchain_messages):
                content = chunk.content
                full_response += content
                yield content

            if "[NEXT]" in full_response:
                # We handle the DB update in the frontend now, but keeping this as backup log is fine
                print(f"👉 AI signaled NEXT")
        except Exception as e:
            yield f"Error: {str(e)}"

    return StreamingResponse(response_generator(), media_type="text/plain")

@app.post("/api/ingest")
async def ingest_book(req: IngestRequest, background_tasks: BackgroundTasks):
    pool = await get_pool()
    await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "processing", req.bookId)
    background_tasks.add_task(process_book, req.bookId, req.fileUrl, req.interest, req.bookType)
    return {"status": "processing_started"}

@app.post("/api/generate_chapter")
async def generate_chapter(req: GenerateChapterRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_chapter_content, req.chapterId)
    return {"status": "started", "message": "Generating..."}

# --- BACKGROUND WORKERS (THE LOGIC ENGINE) ---

# --- ROBUST PROCESS BOOK (Copy into main.py) ---

async def process_book(book_id: str, file_url: str, interest: str, book_type: str):
    print(f"🚀 Starting Smart Scan for Book: {book_id}")
    pool = await get_pool()
    await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "processing", book_id)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(file_url)
            pdf_bytes = resp.content
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        toc = doc.get_toc()
        chapters_to_save = []
        pdf_offset = 0

        # --- MULTI-POINT OFFSET CALIBRATION ---
        if len(toc) > 0:
            try:
                await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "processing_20", book_id)
            except: pass

            # Get valid chapters (exclude contents, preface, etc.)
            exclude_keywords = [
                'content', 'preface', 'foreword', 'index', 'appendix', 'glossary', 'bibliography',
                'cover', 'title page', 'copyright', 'acknowledgement', 'dedication',
                'about the', 'to the student', 'front matter',
            ]
            valid_chapters = [t for t in toc if t[0] == 1 and
                            not any(kw in t[1].lower() for kw in exclude_keywords)]

            # Sample MULTIPLE chapters for accurate offset
            offsets_found = []
            total_valid = len(valid_chapters)

            if total_valid > 0:
                # Sample positions: beginning, middle, end
                sample_positions = [0]
                if total_valid > 2:
                    sample_positions.append(total_valid // 2)
                if total_valid > 4:
                    sample_positions.append(total_valid - 1)

                try:
                    await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "processing_40", book_id)
                except: pass

                for pos in sample_positions[:5]:
                    target_chap = valid_chapters[pos]
                    search_title = target_chap[1].split(":")[0].strip()
                    printed_page = target_chap[2]

                    print(f"🔎 Calibrating with: {search_title} (Printed Pg: {printed_page})")

                    start_search = max(0, printed_page - 25)
                    end_search = min(len(doc), printed_page + 25)

                    ch_num = extract_chapter_number(target_chap[1])
                    title_variants = generate_title_variants(target_chap[1])

                    found_true_page = -1

                    for i in range(start_search, end_search):
                        page = doc[i]
                        blocks = page.get_text("dict")["blocks"]

                        for b in blocks:
                            if b["type"] == 0:
                                for line in b["lines"]:
                                    for span in line["spans"]:
                                        text = span["text"].strip().lower()
                                        size = span["size"]

                                        # Match chapter number pattern (most reliable)
                                        if ch_num and size > 12:
                                            patterns = [f"chapter {ch_num}", f"chapter{ch_num}"]
                                            if any(p in text for p in patterns):
                                                print(f"   ✅ Found 'Chapter {ch_num}' on PDF page {i+1}")
                                                found_true_page = i + 1
                                                break

                                        # Fallback: Match title variants
                                        if found_true_page == -1 and size > 12:
                                            for variant in title_variants:
                                                if len(variant) > 5 and variant in text:
                                                    print(f"   ✅ Found '{variant}' on PDF page {i+1}")
                                                    found_true_page = i + 1
                                                    break
                                    if found_true_page != -1: break
                                if found_true_page != -1: break
                            if found_true_page != -1: break
                        if found_true_page != -1: break

                    if found_true_page != -1:
                        offset = found_true_page - printed_page
                        offsets_found.append(offset)
                        print(f"   📐 Offset: {offset}")

                # Use MEDIAN offset for robustness
                if offsets_found:
                    offsets_found.sort()
                    pdf_offset = offsets_found[len(offsets_found) // 2]
                    print(f"🎯 Final Offset (median of {len(offsets_found)}): {pdf_offset}")
                else:
                    print("⚠️ Could not calibrate offset, using raw TOC")
                    pdf_offset = 0

        try:
            await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "processing_80", book_id)
        except: pass

        # Build Chapter List
        if len(toc) > 0:
            level_1_items = [t for t in toc if t[0] == 1]
            level_2_items = [t for t in toc if t[0] == 2]

            include_level_2 = False
            if len(level_1_items) < 5 and len(level_2_items) > 5:
                include_level_2 = True
            if not level_1_items:
                include_level_2 = True

            for t in toc:
                if t[0] == 1 or (t[0] == 2 and include_level_2):
                    chapters_to_save.append({
                        "title": t[1],
                        "start_page": max(1, t[2] + pdf_offset)
                    })
        else:
            # NO TOC FALLBACK: AI-based chapter detection
            print("📖 No TOC found. Attempting AI-based chapter detection...")

            sample_text = ""
            max_scan_pages = min(500, len(doc))

            for page_num in range(max_scan_pages):
                if page_num % 10 == 0:
                    percent = 10 + int((page_num / max_scan_pages) * 70)
                    try:
                        await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", f"processing_{percent}", book_id)
                    except: pass

                page = doc[page_num]
                page_text = page.get_text()
                sample_text += f"\n--- PAGE {page_num + 1} ---\n{page_text[:2000]}"

            try:
                await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "processing_90", book_id)

                detection_prompt = f"""
Analyze this PDF text to find ALL chapters and their page numbers.

TEXT FROM PDF (with page markers):
{sample_text[:12000]}

TASK: Find the Table of Contents or Contents page and extract ALL chapters with their CORRECT page numbers.

Look for:
1. A "Contents" or "Table of Contents" page that lists chapters with page numbers
2. Chapter headings like "Chapter 1 ........ 15" or "Unit 1 - Introduction ... 23"
3. Any structured list of sections with page numbers

Return a JSON array:
[
  {{"title": "Chapter 1: Introduction", "page": 15}},
  {{"title": "Chapter 2: Basics", "page": 32}}
]

CRITICAL:
- Find ALL chapters, not just the first few
- Use the page numbers from the contents listing
- Return ONLY valid JSON, no explanation
"""

                response = llm.bind(max_tokens=2000).invoke([
                    SystemMessage(content="You extract chapter tables of contents from PDFs. Output only valid JSON array."),
                    HumanMessage(content=detection_prompt)
                ])

                ai_response = response.content.strip()
                ai_response = ai_response.replace("```json", "").replace("```", "").strip()

                detected_chapters = json.loads(ai_response)

                if detected_chapters and len(detected_chapters) > 0:
                    exclude_kw = ['foreword', 'preface', 'acknowledgement', 'introduction by',
                                   'note for', 'notes for', 'about the', 'dedication', 'contents',
                                   'table of', 'index', 'appendix', 'glossary', 'bibliography',
                                   'cover', 'title page', 'copyright', 'to the student', 'front matter']

                    for chap in detected_chapters:
                        title = chap.get("title", "").lower()
                        if not any(kw in title for kw in exclude_kw):
                            chapters_to_save.append({
                                "title": chap.get("title", "Untitled Chapter"),
                                "start_page": max(1, chap.get("page", 1))
                            })

                    print(f"🎯 AI detected {len(chapters_to_save)} chapters!")

            except Exception as ai_err:
                print(f"⚠️ AI chapter detection failed: {ai_err}")
                book_res = await db_fetchrow(pool, "SELECT title FROM course_books WHERE id = $1", book_id)
                book_title = book_res['title'] if book_res and book_res['title'] else "Full Book"

                chapters_to_save.append({
                    "title": book_title,
                    "start_page": 1
                })

        # Save to DB
        await db_execute(pool, "DELETE FROM chapters WHERE book_id = $1", book_id)
        for i, chap in enumerate(chapters_to_save):
            await db_execute(
                pool,
                "INSERT INTO chapters (book_id, title, order_index, start_page_num) VALUES ($1, $2, $3, $4)",
                book_id, chap['title'], i + 1, chap['start_page']
            )

        await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "completed", book_id)
        print(f"✅ Scan Complete.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        traceback.print_exc()
        await db_execute(pool, "UPDATE course_books SET status = $1 WHERE id = $2", "failed", book_id)

def merge_rects(rects, threshold=25):
    if not rects:
        return []
    merged = []
    used = [False] * len(rects)
    for i in range(len(rects)):
        if used[i]:
            continue
        current = fitz.Rect(rects[i])
        used[i] = True
        changed = True
        while changed:
            changed = False
            for j in range(len(rects)):
                if used[j]:
                    continue
                other = fitz.Rect(rects[j])
                expanded = fitz.Rect(current.x0 - threshold, current.y0 - threshold, current.x1 + threshold, current.y1 + threshold)
                if expanded.intersects(other):
                    current = current | other
                    used[j] = True
                    changed = True
        merged.append(current)
    return merged



def extract_tables_from_page(pdf_bytes: bytes, page_num: int) -> List[str]:
    """
    Extract tables from a PDF page using pdfplumber.
    Returns list of HTML table strings.
    """
    tables_html = []

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            if page_num >= len(pdf.pages):
                return tables_html

            page = pdf.pages[page_num]
            extracted_tables = page.extract_tables()

            for table in extracted_tables:
                if not table or len(table) < 2:
                    continue

                # Clean up the table - split multi-line cells
                cleaned_table = []
                for row in table:
                    cleaned_row = []
                    for cell in row:
                        if cell:
                            # Replace newlines with spaces
                            cell = str(cell).replace('\n', ' ').strip()
                        cleaned_row.append(cell or '')
                    cleaned_table.append(cleaned_row)

                # Skip if table is too small
                if len(cleaned_table) < 2:
                    continue

                # Convert to HTML table
                html_out = '<div class="table-container" style="overflow-x: auto; margin: 20px 0; border-radius: 10px; border: 1px solid rgba(139,92,246,0.2);">\n'
                html_out += '<table style="border-collapse: collapse; width: 100%; font-size: 14px; background: transparent;">\n'

                for row_idx, row in enumerate(cleaned_table):
                    # Skip completely empty rows
                    if all(not c for c in row):
                        continue

                    if row_idx == 0:
                        # Header row
                        html_out += '<thead>\n<tr style="background: linear-gradient(135deg, #2d1b69, #1a0540); color: white;">\n'
                        for cell in row:
                            html_out += f'<th style="border: 1px solid rgba(139,92,246,0.25); padding: 11px 14px; text-align: center; font-weight: 600; font-size: 13px; letter-spacing: 0.02em;">{cell}</th>\n'
                        html_out += '</tr>\n</thead>\n<tbody>\n'
                    else:
                        # Data row with alternating colors
                        bg_color = 'rgba(45,27,105,0.25)' if row_idx % 2 == 0 else 'rgba(26,5,64,0.4)'
                        html_out += f'<tr style="background-color: {bg_color};">\n'
                        for cell in row:
                            html_out += f'<td style="border: 1px solid rgba(139,92,246,0.15); padding: 9px 14px; text-align: center; color: #d1d5db;">{cell}</td>\n'
                        html_out += '</tr>\n'

                html_out += '</tbody>\n</table>\n</div>'
                tables_html.append(html_out)

    except Exception as e:
        print(f"   ⚠️ Table extraction error on page {page_num + 1}: {e}")

    return tables_html

async def upload_image_to_supabase(supabase, path: str, img_bytes: bytes, max_retries: int = 3) -> tuple:
    for attempt in range(max_retries):
        try:
            public_url = await asyncio.to_thread(upload_file_to_s3, img_bytes, path, "image/png")
            return (True, public_url, None)
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
            return (False, None, str(e))
    return (False, None, "Max retries exceeded")
def validate_image(img_bytes: bytes, min_width: int = 150, min_height: int = 150) -> tuple:
    """
    Validate image bytes.
    Returns (is_valid, width, height, error_message)
    """
    try:
        img = Image.open(io.BytesIO(img_bytes))
        img.verify()

        # Re-open after verify
        img = Image.open(io.BytesIO(img_bytes))
        width, height = img.size

        if width < min_width or height < min_height:
            return (False, width, height, f"Too small: {width}x{height}")

        # Check if image has actual content (not all white/transparent)
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        # Check for actual content
        extrema = img.getextrema()
        # If all channels have same min/max, image is likely solid color
        is_solid = all(e[0] == e[1] for e in extrema)
        if is_solid:
            return (False, width, height, "Solid color image (no content)")

        return (True, width, height, None)

    except Exception as e:
        return (False, 0, 0, str(e))

def is_watermark_size(width: int, height: int) -> bool:
    # Only filter small squares in the 430-460 range
    if abs(width - height) < 20 and 430 < width < 460:
        print(f"      [DEBUG] Filtering watermark: {width}x{height}")
        return True
    return False

async def upload_image_to_supabase(supabase, path: str, img_bytes: bytes, max_retries: int = 3) -> tuple:
    """Upload image to S3 with retry logic. Returns (success, public_url, error_message)"""
    for attempt in range(max_retries):
        try:
            public_url = await asyncio.to_thread(upload_file_to_s3, img_bytes, path, "image/png")
            return (True, public_url, None)
        except Exception as e:
            error_msg = str(e)
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
            return (False, None, error_msg)

    return (False, None, "Max retries exceeded")


def get_solid_diagram_regions(page):
    """Finds regions on the page that contain dense vector drawings."""
    paths = page.get_drawings()
    if not paths:
        return []

    rects_to_merge = []

    for p in paths:
        r = p["rect"]
        w, h = r.width, r.height

        if w < 5 and h < 5:
            continue
        if w > page.rect.width * 0.9 and h > page.rect.height * 0.9:
            continue

        rects_to_merge.append(r)

    merged = merge_rects(rects_to_merge, threshold=25)
    final_regions = merge_rects(merged, threshold=50)

    valid_regions = []
    for r in final_regions:
        if r.width > 50 and r.height > 50:
            valid_regions.append(r)
    return valid_regions

def is_valid_image_simple(img_bytes: bytes, min_width: int = 80, min_height: int = 80) -> tuple:
    try:
        img = Image.open(io.BytesIO(img_bytes))
        img.verify()
        img = Image.open(io.BytesIO(img_bytes))
        width, height = img.size

        if width < min_width or height < min_height:
            return (False, width, height, f"Too small: {width}x{height}")
        if len(img_bytes) < 500:
            return (False, width, height, "File too small")
        return (True, width, height, None)
    except Exception as e:
        return (False, 0, 0, str(e))


def is_watermark_size(width: int, height: int) -> bool:
    if abs(width - height) < 20 and 430 < width < 460:
        return True
    return False

def _detect_code_blocks(text: str) -> str:
    """
    Detect code patterns in PyMuPDF text and wrap them in markdown code fences.
    Handles C, Python, Java code commonly found in programming textbooks.
    """
    import re

    # Code indicators - if a line matches any of these, it's likely code
    code_patterns = [
        r'^\s*#\s*include',           # #include
        r'^\s*main\s*\(',             # main(
        r'^\s*int\s+\w+',             # int variable
        r'^\s*float\s+\w+',           # float variable
        r'^\s*char\s+\w+',            # char variable
        r'^\s*void\s+\w+',            # void function
        r'^\s*printf\s*\(',           # printf(
        r'^\s*scanf\s*\(',            # scanf(
        r'^\s*return\s',              # return statement
        r'^\s*for\s*\(',              # for loop
        r'^\s*while\s*\(',            # while loop
        r'^\s*if\s*\(',               # if statement
        r'^\s*else\b',               # else
        r'^\s*switch\s*\(',           # switch
        r'^\s*case\s+\w+\s*:',        # case label
        r'^\s*default\s*:',           # default label
        r'^\s*break\s*;',             # break;
        r'^\s*\{',                    # opening brace
        r'^\s*\}',                    # closing brace
        r'.*;\s*$',                   # ends with semicolon
        r'^\s*def\s+\w+',            # Python def
        r'^\s*class\s+\w+',          # class definition
        r'^\s*import\s+\w+',         # import
        r'^\s*print\s*\(',           # Python print
    ]
    compiled = [re.compile(p) for p in code_patterns]

    def is_code_line(line: str) -> bool:
        s = line.strip()
        if not s:
            return False  # empty lines are ambiguous
        return any(p.match(s) for p in compiled)

    lines = text.split('\n')
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this line looks like code
        if is_code_line(line):
            # Collect consecutive code lines (including blank lines between code)
            code_block = [line]
            j = i + 1
            gap = 0  # allow small gaps (blank lines) within code
            while j < len(lines):
                if is_code_line(lines[j]):
                    code_block.append(lines[j])
                    gap = 0
                elif lines[j].strip() == '' and gap < 2:
                    code_block.append(lines[j])
                    gap += 1
                else:
                    break
                j += 1

            # Only wrap if we have 2+ code lines (avoid false positives)
            if sum(1 for l in code_block if l.strip()) >= 2:
                # Remove trailing blanks
                while code_block and not code_block[-1].strip():
                    code_block.pop()
                result.append('```c')
                result.extend(code_block)
                result.append('```')
            else:
                result.extend(code_block)
            i = j
        else:
            result.append(line)
            i += 1

    return '\n'.join(result)


async def process_chapter_content(chapter_id: str):
    """
    Process a chapter with:
    - User-selected book domain (description field)
    - Math books: Skip diagram extraction
    - Physics/CS/Other books: Full diagram extraction
    - TOC validation for books without TOC
    - Proper page boundary checks
    - HTML entity decoding and superscript conversion
    """
    from services.azure_mistral_service import extract_text_with_mistral

    print(f"\n{'='*70}")
    print(f"⚡ Processing Chapter: {chapter_id}")
    print(f"{'='*70}")

    pool = await get_pool()

    # Mark as processing immediately so the frontend stops reading a stale
    # "completed" status and shows live progress from 0%.
    try:
        await db_execute(pool, "UPDATE chapters SET status = $1 WHERE id = $2", "processing_0", chapter_id)
    except Exception:
        pass

    try:
        # Get chapter info
        chapter = await db_fetchrow(pool, "SELECT * FROM chapters WHERE id = $1", chapter_id)
        book_id = chapter['book_id']
        start_page = chapter['start_page_num']
        chapter_title = chapter['title']
        chapter_number = extract_chapter_number(chapter_title)
        current_order = chapter['order_index']

        # Get book info (including description which stores user-selected domain)
        book = await db_fetchrow(pool, "SELECT file_url, title, analogy_topic, description FROM course_books WHERE id = $1", book_id)
        book_title = book.get('title', '') if book else ''
        book_description = book.get('description', '') if book else ''

        # ============================================================
        # DETECT BOOK TYPE (Hybrid: User selection + Title fallback)
        # ============================================================
        book_type = "general"

        if book_description == 'Math':
            book_type = "math"
        elif book_description == 'Science':
            book_type = "science"
        elif book_description == 'Computer Science':
            book_type = "computer"
        elif book_description in ['History', 'Geography', 'Political Science', 'Literature', 'Self Help']:
            book_type = "general"
        elif book_description == 'Others' or not book_description:
            title_lower = book_title.lower()
            if any(kw in title_lower for kw in ['math', 'calculus', 'algebra', 'geometry', 'statistics', 'trigonometry']):
                book_type = "math"
            elif any(kw in title_lower for kw in ['physics', 'chemistry', 'biology', 'science']):
                book_type = "science"
            elif any(kw in title_lower for kw in ['computer', 'programming', 'coding', 'python', 'java', 'javascript']):
                book_type = "computer"
            else:
                book_type = "general"

        book_domain = book_type if book_type != "general" else (book.get('analogy_topic', 'general') if book else 'general')

        print(f"📖 Chapter: '{chapter_title}'")
        print(f"   Book: '{book_title}'")
        print(f"   Domain: {book_description or 'Not set'}")
        print(f"   Type: {book_type.upper()}")
        print(f"   Number: {chapter_number}")
        print(f"   TOC Start: page {start_page}")

        # Load PDF
        cache_dir = "books_cache"
        os.makedirs(cache_dir, exist_ok=True)
        pdf_path = os.path.join(cache_dir, f"{book_id}.pdf")

        if os.path.exists(pdf_path):
            print(f"   📁 Using cached PDF")
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
        else:
            file_url = book['file_url']
            print(f"   ⬇️ Downloading PDF from: {file_url}")
            if file_url and "supabase" in file_url:
                print(f"   ⚠️ WARNING: file_url still points at Supabase storage. "
                      f"This book was not migrated to S3/CloudFront and the download will likely 404.")
            async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
                resp = await client.get(file_url)
                if resp.status_code != 200:
                    raise Exception(
                        f"PDF download failed ({resp.status_code}) for book {book_id} at {file_url}. "
                        f"If this is an old Supabase URL, re-upload the book or migrate the file to S3."
                    )
                pdf_bytes = resp.content
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pdf_pages = len(doc)

        print(f"   📄 PDF has {total_pdf_pages} pages")

        all_chapters = await db_fetch(pool, "SELECT id, title, start_page_num, order_index FROM chapters WHERE book_id = $1 ORDER BY order_index", book_id)
        total_chapters = len(all_chapters) if all_chapters else 1

        # ============================================================
        # DETECT IF BOOK HAS VALID TOC
        # ============================================================
        print(f"\n🔍 Detecting book structure...")

        has_valid_toc = True

        if all_chapters:
            for ch in all_chapters:
                if ch['start_page_num'] > total_pdf_pages:
                    print(f"   ⚠️ Chapter '{ch['title']}' has invalid start page {ch['start_page_num']} > {total_pdf_pages}")
                    has_valid_toc = False
                    break

        chapter_headers_found = []
        if not has_valid_toc or total_chapters <= 1:
            print(f"   🔍 Scanning for chapter headers...")
            for page_num in range(min(total_pdf_pages, 50)):
                page = doc[page_num]
                blocks = page.get_text("dict")["blocks"]

                for b in blocks:
                    if b["type"] != 0:
                        continue

                    for line in b["lines"]:
                        line_text = " ".join([s["text"] for s in line["spans"]])
                        max_size = max([s["size"] for s in line["spans"]])

                        if max_size > 28:
                            text_lower = line_text.lower().strip()
                            if text_lower.startswith("chapter") or re.match(r'^\d+[\.\s]', text_lower):
                                chapter_headers_found.append({
                                    'page': page_num + 1,
                                    'text': line_text[:60],
                                    'size': max_size
                                })
                                print(f"      Found: '{line_text[:50]}...' at page {page_num + 1}")

            if len(chapter_headers_found) <= 1:
                print(f"   📖 This appears to be a SINGLE CHAPTER BOOK (no TOC)")
                has_valid_toc = False
            elif len(chapter_headers_found) >= 2:
                print(f"   📚 Found {len(chapter_headers_found)} chapter headers")

        # ============================================================
        # DETERMINE PAGE RANGE
        # ============================================================

        if not has_valid_toc or total_chapters <= 1:
            print(f"\n📖 SINGLE CHAPTER MODE: Processing entire book")

            start_idx = 0
            end_idx = total_pdf_pages - 1

            for page_num in range(min(10, total_pdf_pages)):
                page = doc[page_num]
                text = page.get_text("text")
                if len(text.strip()) > 200:
                    start_idx = page_num
                    break

            print(f"   Content starts at page {start_idx + 1}")
            print(f"   Content ends at page {end_idx + 1}")

        else:
            print(f"\n📚 MULTI-CHAPTER MODE: Using TOC")

            print(f"\n🔍 Step 1: Finding chapter start...")

            start_idx = max(0, min(start_page - 1, total_pdf_pages - 1))
            search_range = 35
            found_start = False

            for offset in range(search_range):
                for direction in [0, 1, -1]:
                    check_idx = start_idx + offset * direction if direction != 0 else start_idx + offset

                    if check_idx < 0 or check_idx >= total_pdf_pages:
                        continue

                    page = doc[check_idx]
                    blocks = page.get_text("dict")["blocks"]

                    for b in blocks:
                        if b["type"] != 0:
                            continue

                        for line in b["lines"]:
                            line_text = " ".join([s["text"] for s in line["spans"]])
                            max_size = max([s["size"] for s in line["spans"]])

                            if max_size > 30 and chapter_number:
                                nums = re.findall(r'\d+', line_text)
                                if nums and len(nums) == 1 and int(nums[0]) == chapter_number:
                                    new_start = check_idx + 1
                                    if new_start != start_page:
                                        print(f"   ✅ Corrected: page {start_page} → {new_start}")
                                        start_page = new_start
                                        start_idx = check_idx
                                        await db_execute(pool, "UPDATE chapters SET start_page_num = $1 WHERE id = $2", new_start, chapter_id)
                                    else:
                                        print(f"   ✅ Start confirmed: page {start_page}")
                                    found_start = True
                                    break
                        if found_start:
                            break
                    if found_start:
                        break
                if found_start:
                    break

            if not found_start:
                print(f"   ⚠️ Using TOC value: page {start_page}")
                start_idx = max(0, min(start_page - 1, total_pdf_pages - 1))

            print(f"\n🔍 Step 2: Finding chapter end...")

            next_chap_rows = await db_fetch(
                pool,
                "SELECT start_page_num, title, order_index FROM chapters WHERE book_id = $1 AND order_index > $2 ORDER BY order_index LIMIT 1",
                book_id, current_order
            )
            next_chap = next_chap_rows[0] if next_chap_rows else None

            if next_chap:
                next_start_toc = next_chap['start_page_num']
                next_title = next_chap['title']
                next_ch_num = chapter_number + 1 if chapter_number else None

                print(f"   Next chapter: '{next_title}' (TOC says page {next_start_toc})")

                next_idx = min(next_start_toc - 1, total_pdf_pages - 1)
                end_idx = min(next_start_toc - 2, total_pdf_pages - 1)
                found_next = False

                for offset in range(25):
                    for direction in [0, 1, -1]:
                        check_idx = next_idx + offset * direction if direction != 0 else next_idx + offset

                        if check_idx < 0 or check_idx >= total_pdf_pages:
                            continue

                        page = doc[check_idx]
                        blocks = page.get_text("dict")["blocks"]

                        for b in blocks:
                            if b["type"] != 0:
                                continue

                            for line in b["lines"]:
                                line_text = " ".join([s["text"] for s in line["spans"]])
                                max_size = max([s["size"] for s in line["spans"]])

                                if max_size > 30 and next_ch_num:
                                    nums = re.findall(r'\d+', line_text)
                                    if nums and len(nums) == 1 and int(nums[0]) == next_ch_num:
                                        end_idx = check_idx - 1
                                        print(f"   ✅ Next chapter found at page {check_idx + 1}")
                                        print(f"   ✅ This chapter ends at page {end_idx + 1}")
                                        found_next = True
                                        break
                            if found_next:
                                break
                        if found_next:
                            break
                    if found_next:
                        break

                if not found_next:
                    end_idx = min(next_start_toc - 2, total_pdf_pages - 1)
                    print(f"   ⚠️ Using TOC boundary: page {end_idx + 1}")
            else:
                end_idx = total_pdf_pages - 1
                print(f"   Last chapter, ends at page {end_idx + 1}")

            if end_idx < start_idx:
                print(f"   ⚠️ ERROR: end < start! Adjusting...")
                end_idx = min(start_idx + 14, total_pdf_pages - 1)

        start_idx = max(0, min(start_idx, total_pdf_pages - 1))
        end_idx = max(start_idx, min(end_idx, total_pdf_pages - 1))

        total_pages = end_idx - start_idx + 1

        print(f"\n{'='*50}")
        print(f"📄 PAGE RANGE CONFIRMED:")
        print(f"   PDF Total Pages: {total_pdf_pages}")
        print(f"   Start: PDF page {start_idx + 1}")
        print(f"   End:   PDF page {end_idx + 1}")
        print(f"   Total: {total_pages} pages")
        print(f"{'='*50}")

        await db_execute(pool, "DELETE FROM paragraphs WHERE chapter_id = $1", chapter_id)

        # Move the progress bar off 0% during the (potentially long) image
        # extraction phase that happens before OCR begins.
        try:
            await db_execute(pool, "UPDATE chapters SET status = $1 WHERE id = $2", "processing_3", chapter_id)
        except Exception:
            pass

        # ============================================================
        # CONFIGURATION BASED ON BOOK TYPE
        # ============================================================
        print(f"\n📸 Step 3: Extracting content...")

        if book_type == "math":
            print(f"   📐 MATH BOOK: Skipping diagram extraction")
            extract_diagrams = False
            extract_images = False
        else:
            print(f"   📚 {book_type.upper()} BOOK: Full diagram extraction")
            extract_diagrams = True
            extract_images = True

        page_texts = []
        page_images = []
        page_tables = []
        upload_queue = []
        ocr_jobs = []
        ocr_index_map = {}
        current_section = chapter_title

        for page_num in range(start_idx, end_idx + 1):
            # Yield to the event loop on every page so this CPU-heavy background
            # task doesn't starve the API (single uvicorn worker) and time out
            # every request while a chapter is generating.
            await asyncio.sleep(0)

            if page_num < 0 or page_num >= total_pdf_pages:
                print(f"   ⚠️ Skipping out-of-bounds page {page_num}")
                continue

            page = doc[page_num]
            page_rect = page.rect
            blocks = page.get_text("dict")["blocks"]
            this_page_images = []
            ignore_rects = []

            # Offload table extraction (opens its own pdfplumber doc) to a thread
            # so it doesn't block the event loop.
            tables_html = await asyncio.to_thread(extract_tables_from_page, pdf_bytes, page_num)
            page_tables.append(tables_html)

            if tables_html:
                print(f"   📊 Page {page_num + 1}: {len(tables_html)} table(s)")

            if extract_diagrams:
                try:
                    diagram_rects = get_solid_diagram_regions(page)

                    for d_rect in diagram_rects:
                        if d_rect.width < 100 or d_rect.height < 100:
                            continue

                        aspect_ratio = d_rect.width / d_rect.height if d_rect.height > 0 else 0
                        if aspect_ratio > 5:
                            continue

                        rect_area = d_rect.width * d_rect.height
                        page_area = page_rect.width * page_rect.height
                        if rect_area > page_area * 0.5:
                            continue

                        try:
                            mat = fitz.Matrix(2.0, 2.0)
                            pix = page.get_pixmap(matrix=mat, clip=d_rect)
                            if pix.alpha:
                                pix = fitz.Pixmap(pix, 0)
                            img_bytes = pix.tobytes("png")

                            if await is_valid_diagram(img_bytes):
                                idx = len(page_images) * 100 + len(this_page_images)
                                filename = f"{book_id}/{chapter_id}_{idx}.png"
                                upload_queue.append((filename, img_bytes))
                                url = get_cloudfront_url(filename)
                                this_page_images.append({
                                    "chapter_id": chapter_id,
                                    "content": url,
                                    "type": "image",
                                    "section_title": current_section,
                                    "is_completed": False
                                })
                                ignore_rects.append(d_rect)
                        except Exception as e:  # TEMP DIAG — revert when done
                            print(f"⚠️ diagram drop: {e}")
                except Exception as e:  # TEMP DIAG — revert when done
                    print(f"⚠️ diagram drop: {e}")

            if extract_images:
                for block in blocks:
                    if block["type"] != 1:
                        continue

                    bbox = fitz.Rect(block["bbox"])
                    if bbox.width < 150 or bbox.height < 150:
                        continue

                    aspect_ratio = bbox.width / bbox.height if bbox.height > 0 else 0
                    if aspect_ratio > 4:
                        continue

                    area_pct = (bbox.width * bbox.height) / (page_rect.width * page_rect.height) * 100
                    if area_pct > 90:
                        continue

                    skip = any(bbox & ir for ir in ignore_rects) if ignore_rects else False
                    if skip:
                        continue

                    try:
                        mat = fitz.Matrix(2.0, 2.0)
                        pix = page.get_pixmap(matrix=mat, clip=bbox)
                        if pix.alpha:
                            pix = fitz.Pixmap(pix, 0)
                        img_bytes = pix.tobytes("png")

                        if await is_valid_diagram(img_bytes):
                            idx = len(page_images) * 100 + len(this_page_images)
                            filename = f"{book_id}/{chapter_id}_{idx}.png"
                            upload_queue.append((filename, img_bytes))
                            url = get_cloudfront_url(filename)
                            this_page_images.append({
                                "chapter_id": chapter_id,
                                "content": url,
                                "type": "image",
                                "section_title": current_section,
                                "is_completed": False
                            })
                    except:
                        pass

            pix = page.get_pixmap()
            if pix.alpha:
                pix = fitz.Pixmap(pix, 0)

            ocr_index_map[len(ocr_jobs)] = len(page_texts)
            ocr_jobs.append(pix.tobytes("png"))
            page_texts.append(None)
            page_images.append(this_page_images)

        print(f"   Images: {len(upload_queue)}, Tables: {sum(len(t) for t in page_tables)}, Pages: {len(ocr_jobs)}")

        if upload_queue:
            print(f"\n📤 Uploading {len(upload_queue)} images...")

            async def upload_worker(path, data):
                try:
                    await asyncio.to_thread(upload_file_to_s3, data, path, "image/png")
                except:
                    pass

            await asyncio.gather(*[upload_worker(p, d) for p, d in upload_queue])
            print(f"   ✅ Done")

        # ============================================================
        # RUN OCR WITH MATH TEXT CLEANING
        # ============================================================
        print(f"\n🔍 Running OCR...")

        if ocr_jobs:
            sem = asyncio.Semaphore(4)
            completed = [0]

            async def ocr_worker(img_bytes, idx):
                async with sem:
                    result = await extract_text_with_mistral(img_bytes, domain=book_domain)
                    result = clean_math_text(result)
                    completed[0] += 1
                    if completed[0] % 5 == 0 or completed[0] == len(ocr_jobs):
                        pct = int((completed[0] / len(ocr_jobs)) * 90)
                        try:
                            await db_execute(pool, "UPDATE chapters SET status = $1 WHERE id = $2", f"processing_{pct}", chapter_id)
                        except:
                            pass
                    return result

            results = await asyncio.gather(*[ocr_worker(img, i) for i, img in enumerate(ocr_jobs)])

            for i, text in enumerate(results):
                page_texts[ocr_index_map[i]] = text

        # ============================================================
        # BUILD PARAGRAPHS
        # ============================================================
        print(f"\n📝 Step 4: Building paragraphs...")

        paragraphs = []
        order_idx = 1

        for page_idx in range(len(page_texts)):
            for img in page_images[page_idx]:
                img["order_index"] = order_idx
                paragraphs.append(img)
                order_idx += 1

            for table_html in page_tables[page_idx]:
                paragraphs.append({
                    "chapter_id": chapter_id,
                    "content": table_html,
                    "type": "text",
                    "order_index": order_idx,
                    "section_title": current_section,
                    "is_completed": False
                })
                order_idx += 1

            text = page_texts[page_idx]
            if not text or len(text.strip()) < 5:
                continue

            for para in [p.strip() for p in text.split("\n\n") if p.strip()]:
                if len(para) < 3:
                    continue

                if re.match(r'^Table\s+\d+', para, re.IGNORECASE):
                    continue

                if chapter_title:
                    t1 = chapter_title.lower().replace(' ', '').replace(':', '').replace('-', '')
                    t2 = para.lower().replace(' ', '').replace(':', '').replace('-', '')
                    if t1 == t2:
                        continue

                words = para.split()
                if len(words) <= 4 and len(para) < 50:
                    cap_count = sum(1 for w in words if w and w[0].isupper())
                    if cap_count >= len(words) * 0.5:
                        if not para.endswith(('.', ',', ';', ')')):
                            if not any(c in para for c in ['{', '}', '(', ')', '=']):
                                current_section = para[:60]
                                continue

                if paragraphs and len(para) < 400:
                    last = paragraphs[-1]
                    if last["type"] == "text" and len(last["content"]) < 1500:
                        last["content"] += "\n\n" + para
                        continue

                paragraphs.append({
                    "chapter_id": chapter_id,
                    "content": para,
                    "type": "text",
                    "order_index": order_idx,
                    "section_title": current_section,
                    "is_completed": False
                })
                order_idx += 1

        if paragraphs:
            print(f"💾 Saving {len(paragraphs)} items...")
            for i in range(0, len(paragraphs), 100):
                batch = paragraphs[i:i+100]
                for p in batch:
                    await db_execute(
                        pool,
                        "INSERT INTO paragraphs (chapter_id, content, type, order_index, section_title, is_completed) VALUES ($1, $2, $3, $4, $5, $6)",
                        p["chapter_id"], p["content"], p["type"], p["order_index"], p["section_title"], p["is_completed"]
                    )

        await db_execute(pool, "UPDATE chapters SET status = $1 WHERE id = $2", "completed", chapter_id)

        text_count = len([p for p in paragraphs if p["type"] == "text"])
        image_count = len([p for p in paragraphs if p["type"] == "image"])

        print(f"\n{'='*70}")
        print(f"✅ COMPLETE: {chapter_title}")
        print(f"   Book Type: {book_type.upper()}")
        print(f"   Pages: {total_pages}")
        print(f"   Text: {text_count}, Images: {image_count}")
        print(f"{'='*70}")

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        try:
            await db_execute(pool, "UPDATE chapters SET status = $1 WHERE id = $2", "failed", chapter_id)
        except:
            pass

async def load_pdf(book_id: str, file_url: str):
    """Load PDF from cache or download."""
    import os

    cache_dir = "books_cache"
    os.makedirs(cache_dir, exist_ok=True)
    pdf_path = os.path.join(cache_dir, f"{book_id}.pdf")

    if os.path.exists(pdf_path):
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
    else:
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.get(file_url)
            resp.raise_for_status()
            pdf_bytes = resp.content
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

    return fitz.open(stream=pdf_bytes, filetype="pdf")


async def extract_chapter_content(doc, start_idx: int, end_idx: int,
                                   chapter_id: str, chapter_title: str,
                                   book_domain: str, book_id: str):
    """Extract images and OCR text from chapter pages."""
    from services.azure_mistral_service import extract_text_with_mistral
    import asyncio

    page_texts = []
    page_images = []
    paragraphs_to_insert = []
    upload_queue = []
    ocr_jobs = []
    ocr_index_map = {}
    current_section = chapter_title

    for page_num in range(start_idx, end_idx):
        page = doc[page_num]
        page_rect = page.rect
        blocks = page.get_text("dict")["blocks"]
        this_page_images = []

        # Extract images (same as before, abbreviated for space)
        try:
            diagram_rects = get_solid_diagram_regions(page)
            for d_rect in diagram_rects:
                if d_rect.width < 100 or d_rect.height < 100:
                    continue
                try:
                    mat = fitz.Matrix(2.0, 2.0)
                    pix = page.get_pixmap(matrix=mat, clip=d_rect)
                    if pix.alpha: pix = fitz.Pixmap(pix, 0)
                    img_bytes = pix.tobytes("png")

                    if await is_valid_diagram(img_bytes):
                        idx = len(page_images) * 100 + len(this_page_images)
                        filename = f"{book_id}/{chapter_id}_{idx}.png"
                        upload_queue.append((filename, img_bytes))
                        url = supabase.storage.from_("book-assets").get_public_url(filename)
                        this_page_images.append({
                            "chapter_id": chapter_id, "content": url, "type": "image",
                            "section_title": current_section, "is_completed": False
                        })
                except Exception as e:  # TEMP DIAG — revert when done
                    print(f"⚠️ diagram drop: {e}")
        except Exception as e:  # TEMP DIAG — revert when done
            print(f"⚠️ diagram drop: {e}")

        # Queue OCR
        pix = page.get_pixmap()
        if pix.alpha: pix = fitz.Pixmap(pix, 0)
        ocr_index_map[len(ocr_jobs)] = len(page_texts)
        ocr_jobs.append((pix.tobytes("png"), current_section, page_num))
        page_texts.append(None)
        page_images.append(this_page_images)

    # Upload images
    if upload_queue:
        async def upload_worker(path, data):
            try:
                await asyncio.to_thread(
                    supabase.storage.from_("book-assets").upload,
                    path=path, file=data,
                    file_options={"content-type": "image/png", "upsert": "true"}
                )
            except: pass
        await asyncio.gather(*[upload_worker(p, d) for p, d in upload_queue])

    # Run OCR
    if ocr_jobs:
        sem = asyncio.Semaphore(4)
        async def ocr_worker(img, sec, idx):
            async with sem:
                return await extract_text_with_mistral(img, domain=book_domain)

        results = await asyncio.gather(*[ocr_worker(img, sec, i) for i, (img, sec, _) in enumerate(ocr_jobs)])
        for ocr_idx, text in enumerate(results):
            page_texts[ocr_index_map[ocr_idx]] = text

    return page_texts, page_images, paragraphs_to_insert


def detect_domain(title: str) -> str:
    """Detect book domain from title."""
    t = title.lower()
    if "physics" in t or "science" in t: return "physics"
    if "math" in t or "calculus" in t: return "math"
    if "biology" in t: return "biology"
    if "chemistry" in t: return "chemistry"
    if "history" in t: return "history"
    if "geography" in t: return "geography"
    return "general"

@app.post("/api/speak")
async def speak_endpoint(req: TTSRequest):

    unique_str = f"{req.text}_{req.language}"
    file_hash = hashlib.md5(unique_str.encode()).hexdigest()
    filename = f"{file_hash}.mp3"

    # Define a static cache folder
    cache_dir = "static/audio_cache"
    os.makedirs(cache_dir, exist_ok=True)
    file_path = os.path.join(cache_dir, filename)

    if os.path.exists(file_path):
        print("🚀 Serving from Cache (Instant!)")
        return FileResponse(file_path, media_type="audio/mpeg")

    # If not in cache, generate it
    generated_path, _ = await generate_audio(req.text, req.language, llm)
    if generated_path:
        import shutil
        shutil.move(generated_path, file_path)
        return FileResponse(file_path, media_type="audio/mpeg")

    return {"error": "Failed"}

    print(f"🔊 Generating Audio in {req.language}")

    # We pass the global 'llm' object we created in main.py
    file_path, translated_text = await generate_audio(req.text, req.language, llm)

    if not file_path:
        return {"error": "Failed to generate audio"}

    # Return the file directly as a stream
    # We also send the translated text in a header if you want to display it
    return FileResponse(
        file_path,
        media_type="audio/mpeg",
        headers={"X-Translated-Text": str(translated_text.encode('utf-8'))} # Optional: tricky with headers
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
