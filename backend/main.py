import os
import fitz # PyMuPDF
import re
import json
import hashlib
import httpx
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.responses import FileResponse
from services.tts_service import generate_audio


# --- IMPORTS ---
from langchain_openai import ChatOpenAI 
from langchain_core.messages import HumanMessage, SystemMessage
from db import supabase 
from services.vision_service import analyze_diagram, describe_image
from services.mermaid_service import generate_concept_diagram, personalize_image_explanation
from routers import scheduler, stats, admin, subscription, rate_limits, payment, contact

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

# --- MODELS ---
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
    response = supabase.table("paragraphs").select("content").in_("id", req.completedBlockIds).execute()
    blocks = response.data

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

    # Step 1: Check if we already have a personalized explanation for this user's interest
    existing = supabase.table("paragraphs").select("explanation, image_description, analogy_topic").eq("id", req.paragraphId).single().execute()
    
    # If we have a cached explanation with the SAME interest, return it
    if existing.data and existing.data.get("explanation"):
        cached_topic = existing.data.get("analogy_topic", "")
        if cached_topic.lower() == req.analogyTopic.lower():
            print(f"✅ Returning cached explanation (same interest)")
            return {"explanation": existing.data["explanation"]}
    
    # Step 2: Check if we have a cached IMAGE DESCRIPTION (the expensive part)
    image_description = existing.data.get("image_description") if existing.data else None
    
    if not image_description:
        # No cached description - call Vision API ONCE to describe the image
        print(f"🔍 No cached description. Calling Vision API...")
        image_description = await describe_image(req.imageUrl, req.context)
        
        # Cache the description for future users
        if "Error" not in image_description:
            supabase.table("paragraphs").update({
                "image_description": image_description
            }).eq("id", req.paragraphId).execute()
            print(f"💾 Cached image description")
    else:
        print(f"✅ Using cached image description")
    
    # Step 3: Personalize with user's interest using DeepSeek (cheap!)
    print(f"🎨 Personalizing with interest: {req.analogyTopic}")
    explanation = personalize_image_explanation(image_description, req.analogyTopic, req.context)

    # Save the personalized explanation
    if "Error" not in explanation:
        supabase.table("paragraphs").update({
            "explanation": explanation,
            "analogy_topic": req.analogyTopic
        }).eq("id", req.paragraphId).execute()

    return {"explanation": explanation}

# 💬 C. CHAT & PROGRESS
# Replace the existing /chat endpoint in main.py

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    system_context = "You are a helpful AI Tutor."
    
    # 1. Fetch Book-Specific Interest from DB
    user_interest = "general" # Default
    try:
        if req.bookId:
            book_res = supabase.table("course_books").select("analogy_topic").eq("id", req.bookId).single().execute()
            if book_res.data and book_res.data.get('analogy_topic'):
                fetched = book_res.data['analogy_topic'].strip()
                if fetched: user_interest = fetched
    except Exception as e:
        print(f"⚠️ Could not fetch book interest: {e}")

    print(f"💬 Chat Context: {user_interest}") # Debug print to console

    # 2. Build Context based on Paragraph
    if req.currentParagraphId:
        try:
            para_res = supabase.table("paragraphs").select("content, section_title").eq("id", req.currentParagraphId).single().execute()
            
            if para_res.data:
                para_content = para_res.data['content']
                section_title = para_res.data.get('section_title', 'General Section')
                
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
    supabase.table("course_books").update({"status": "processing"}).eq("id", req.bookId).execute()
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
    supabase.table("course_books").update({"status": "processing"}).eq("id", book_id).execute()
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(file_url)
            pdf_bytes = resp.content
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        toc = doc.get_toc() 
        chapters_to_save = []
        pdf_offset = 0

        # --- SMART OFFSET CALIBRATION (UPDATED) ---
        if len(toc) > 0:
            # 1. Find a valid target chapter (avoid 'Contents' or 'Preface')
            valid_chapters = [t for t in toc if t[0] == 1 and "content" not in t[1].lower()]
            
            if valid_chapters:
                target_chap = valid_chapters[0]
                search_title = target_chap[1].split(":")[0].strip() # e.g. "Chapter 3"
                printed_page = target_chap[2]
                
                print(f"🔎 Calibrating Offset using: {search_title} (Meta Pg: {printed_page})")
                
                # Search +/- 20 pages
                start_search = max(0, printed_page - 20)
                end_search = min(len(doc), printed_page + 20)
                
                found_true_page = -1
                
                for i in range(start_search, end_search):
                    page = doc[i]
                    blocks = page.get_text("dict")["blocks"]
                    
                    # SCAN BLOCKS FOR LARGE TEXT MATCH
                    for b in blocks:
                        if b["type"] == 0: # Text block
                            for line in b["lines"]:
                                for span in line["spans"]:
                                    text = span["text"].strip()
                                    size = span["size"]
                                    
                                    # CRITICAL FIX: Only accept if font size > 12 (Heuristic for Headers)
                                    # And check if it matches the title
                                    if search_title.lower() in text.lower() and size > 12:
                                        print(f"   FOUND MATCH on Pg {i+1}: '{text}' (Size: {size})")
                                        found_true_page = i + 1
                                        break
                                if found_true_page != -1: break
                        if found_true_page != -1: break
                    if found_true_page != -1: break
                
                if found_true_page != -1:
                    pdf_offset = found_true_page - printed_page
                    print(f"🎯 Offset Detected: {pdf_offset} (True Page: {found_true_page})")
                else:
                    print("⚠️ Could not verify offset with large text. Using Metadata raw.")
        
        # Build Chapter List
        if len(toc) > 0:
            # Analyze TOC Structure
            level_1_items = [t for t in toc if t[0] == 1]
            level_2_items = [t for t in toc if t[0] == 2]
            
            # Smart Selection Strategy
            include_level_2 = False
            
            # Case A: Very few Level 1 items (e.g. just "Parts") but many Level 2 ("Chapters")
            if len(level_1_items) < 5 and len(level_2_items) > 5:
                include_level_2 = True
            
            # Case B: No Level 1 items at all
            if not level_1_items:
                include_level_2 = True

            for t in toc:
                # Logic: Keep if Lvl 1 OR (Lvl 2 AND we decided to include them)
                if t[0] == 1 or (t[0] == 2 and include_level_2):
                    # Optional: Check keywords if it's Level 2 to avoid noise? 
                    # For now, let's just be inclusive.
                    chapters_to_save.append({
                        "title": t[1],
                        "start_page": max(1, t[2] + pdf_offset)
                    })
        else:
            # NO TOC FALLBACK: Try AI-based chapter detection
            print("📖 No TOC found. Attempting AI-based chapter detection...")
            
            # Extract text from WHOLE BOOK to find TOC (Don't limit to 100 pages)
            sample_text = ""
            # Limit to first 500 pages to avoid memory explosion on massive books, but 500 covers most TOCs
            for page_num in range(min(500, len(doc))):
                page = doc[page_num]
                page_text = page.get_text()
                sample_text += f"\n--- PAGE {page_num + 1} ---\n{page_text[:2000]}"
            
            # Use DeepSeek to detect chapters
            try:
                detection_prompt = f"""
Analyze this PDF text to find ALL chapters and their page numbers.

TEXT FROM PDF (with page markers):
{sample_text[:12000]}

TASK: Find the Table of Contents or Contents page and extract ALL chapters with their CORRECT page numbers.

Look for:
1. A "Contents" or "Table of Contents" page that lists chapters with page numbers
2. Chapter headings like "Chapter 1 ........ 15" or "Unit 1 - Introduction ... 23"
3. Any structured list of sections with page numbers

Extract ALL chapters found. Use the page numbers shown in the Contents listing, NOT the PDF page number where you found the listing.

Return a JSON array:
[
  {{"title": "Chapter 1: Introduction", "page": 15}},
  {{"title": "Chapter 2: Basics", "page": 32}},
  {{"title": "Chapter 3: Advanced", "page": 58}}
]

CRITICAL:
- Find ALL chapters, not just the first few
- Use the page numbers from the contents listing (like "Chapter 1 ...... 15" means page 15)
- Return ONLY valid JSON, no explanation
"""
                
                # Use higher max_tokens to ensure all chapters are returned
                response = llm.bind(max_tokens=2000).invoke([
                    SystemMessage(content="You extract chapter tables of contents from PDFs. Find ALL chapters and their CORRECT page numbers from the contents listing. Output only valid JSON array."),
                    HumanMessage(content=detection_prompt)
                ])
                
                # Parse the AI response
                ai_response = response.content.strip()
                print(f"🤖 AI Raw Response: {ai_response[:500]}...")
                
                # Clean up markdown if present
                ai_response = ai_response.replace("```json", "").replace("```", "").strip()
                
                detected_chapters = json.loads(ai_response)
                print(f"📋 Parsed chapters: {detected_chapters}")
                
                if detected_chapters and len(detected_chapters) > 0:
                    # Filter out non-chapters (preface, foreword, acknowledgements, notes, etc.)
                    exclude_keywords = ['foreword', 'preface', 'acknowledgement', 'introduction by', 
                                       'note for', 'notes for', 'about the', 'dedication', 'contents',
                                       'table of', 'index', 'appendix', 'glossary', 'bibliography']
                    
                    filtered_chapters = []
                    for chap in detected_chapters:
                        title = chap.get("title", "").lower()
                        if not any(kw in title for kw in exclude_keywords):
                            filtered_chapters.append(chap)
                    
                    print(f"🎯 AI detected {len(detected_chapters)} entries, kept {len(filtered_chapters)} chapters!")
                    
                    for chap in filtered_chapters:
                        chapters_to_save.append({
                            "title": chap.get("title", "Untitled Chapter"),
                            "start_page": max(1, chap.get("page", 1))
                        })
                else:
                    raise ValueError("No chapters detected - empty array")
                    
            except Exception as ai_err:
                print(f"⚠️ AI chapter detection failed: {ai_err}")
                # Final fallback: Create single chapter
                book_res = supabase.table("course_books").select("title").eq("id", book_id).single().execute()
                book_title = "Full Book"
                if book_res.data and book_res.data.get("title"):
                    book_title = book_res.data["title"]
                
                chapters_to_save.append({
                    "title": book_title,
                    "start_page": 1
                })

        # Save to DB
        supabase.table("chapters").delete().eq("book_id", book_id).execute()
        for i, chap in enumerate(chapters_to_save):
            supabase.table("chapters").insert({
                "book_id": book_id,
                "title": chap['title'],
                "order_index": i + 1,
                "start_page_num": chap['start_page']
            }).execute()

        supabase.table("course_books").update({"status": "completed"}).eq("id", book_id).execute()
        print(f"✅ Scan Complete.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        supabase.table("course_books").update({"status": "failed"}).eq("id", book_id).execute()

# --- HELPER: Vector Diagram Detection ---
def merge_rects(rects, threshold=15):
    """Merges rectangles that are close to each other."""
    if not rects: return []
    rects.sort(key=lambda r: r.y0) # Sort by vertical position
    merged = []
    
    current = rects[0]
    for i in range(1, len(rects)):
        next_rect = rects[i]
        
        # Check if close vertically and horizontally
        # Expanded logic: if they overlap or constitute a single visual block
        
        # Vertical gap check
        v_gap = max(0, next_rect.y0 - current.y1)
        h_overlap = max(0, min(current.x1, next_rect.x1) - max(current.x0, next_rect.x0))
        
        # If they are close vertically OR (overlap horizontally AND are somewhat close)
        if v_gap < threshold or (v_gap < threshold * 3 and h_overlap > 0):
             current = current | next_rect # Union
        else:
            merged.append(current)
            current = next_rect
            
    merged.append(current)
    return merged

def get_solid_diagram_regions(page):
    """Finds regions on the page that contain dense vector drawings (lines, curves)."""
    paths = page.get_drawings()
    if not paths: return []
    
    rects_to_merge = []
    
    for p in paths:
        # Ignore huge full-page borders or tiny dots
        r = p["rect"]
        w, h = r.width, r.height
        
        # Filter noise
        if w < 5 and h < 5: continue # Too small dot
        if w > page.rect.width * 0.9 and h > page.rect.height * 0.9: continue # Page border
        
        rects_to_merge.append(r)
        
    # Heuristic: Merge close drawings
    # Pass 1
    merged = merge_rects(rects_to_merge, threshold=25)
    
    # Pass 2 (Aggressive merge)
    final_regions = merge_rects(merged, threshold=50)
    
    # Filter for significant size
    valid_regions = []
    for r in final_regions:
        # Must be at least 10% of page width or reasonably tall
        if r.width > 50 and r.height > 50:
            valid_regions.append(r)
            
    return valid_regions

async def process_chapter_content(chapter_id: str):
    print(f"⚡ Processing Chapter Content: {chapter_id}")
    
    try:
        chapter = supabase.table("chapters").select("*").eq("id", chapter_id).single().execute()
        book_id = chapter.data['book_id']
        start_page = chapter.data['start_page_num']
        
        book = supabase.table("course_books").select("file_url").eq("id", book_id).single().execute()
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(book.data['file_url'])
            pdf_bytes = resp.content
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        next_chap = supabase.table("chapters").select("start_page_num").eq("book_id", book_id).gt("order_index", chapter.data['order_index']).order("order_index").limit(1).execute()
        
        # --- NEW LOGIC: Calculate precise page range ---
        start_idx = max(0, start_page - 1)
        end_idx = len(doc) # Default to end

        if next_chap.data:
            # If there is a next chapter, stop before it
            end_idx = max(0, next_chap.data[0]['start_page_num'] - 1)
        
        # Determine total pages
        total_pages_to_process = end_idx - start_idx
        print(f"📖 Processing Ch {chapter.data['order_index']}: Pages {start_idx+1} to {end_idx} (Total: {total_pages_to_process})")
        
        processed_pages_count = 0

        supabase.table("paragraphs").delete().eq("chapter_id", chapter_id).execute()

        global_order_index = 1 # Re-added this line as it was missing from the provided snippet but is used later.
        current_context = ""
        current_section = chapter.data['title'] 
        paragraphs_to_insert = []

        for page_num in range(start_idx, end_idx):
            # --- PROGRESS UPDATE ---
            processed_pages_count += 1
            if total_pages_to_process > 0:
                percent = int((processed_pages_count / total_pages_to_process) * 100)
                # Update DB every 3 pages or if it's the last one
                if processed_pages_count % 3 == 0 or processed_pages_count == total_pages_to_process:
                     try:
                         supabase.table("chapters").update({"status": f"processing_{percent}"}).eq("id", chapter_id).execute()
                         print(f"⏳ Progress: {percent}%")
                     except Exception as e:
                         print(f"⚠️ Progress Update Failed (Non-Critical): {e}")

            page = doc[page_num]
            page_rect = page.rect
            blocks = page.get_text("dict")["blocks"]

            # --- A. DETECT VECTOR DIAGRAMS ---
            diagram_rects = get_solid_diagram_regions(page)
            ignore_rects = [] # Areas where we have extracted a diagram, so ignore text here
            
            for d_rect in diagram_rects:
                # Expand slightly to catch labels just outside
                d_rect_expanded = fitz.Rect(d_rect.x0 - 5, d_rect.y0 - 5, d_rect.x1 + 5, d_rect.y1 + 5)
                
                try:
                    # Render the Diagram Region
                    mat = fitz.Matrix(2.0, 2.0)
                    pix = page.get_pixmap(matrix=mat, clip=d_rect_expanded)
                    if pix.alpha: pix = fitz.Pixmap(pix, 0)

                    filename = f"diagrams/{book_id}/{chapter_id}_{global_order_index}.png"
                    
                    # Upload
                    supabase.storage.from_("book-assets").upload(
                        path=filename, file=pix.tobytes("png"),
                        file_options={"content-type": "image/png", "upsert": "true"}
                    )
                    public_url = supabase.storage.from_("book-assets").get_public_url(filename)
                    
                    paragraphs_to_insert.append({
                        "chapter_id": chapter_id, 
                        "content": public_url, 
                        "type": "image", # Treat as image
                        "order_index": global_order_index, 
                        "section_title": current_section,
                        "is_completed": False
                    })
                    global_order_index += 1
                    
                    ignore_rects.append(d_rect_expanded)
                    print(f"   🎨 Extracted Diagram at {d_rect}")
                    
                except Exception as e:
                    print(f"   ⚠️ Diagram Extraction Failed: {e}")
            
            # --- B. PROCESS STANDARD BLOCKS ---
            for block in blocks:
                block_bbox = fitz.Rect(block["bbox"])
                
                # CHECK CONFLICT: Is this block inside a diagram we already extracted?
                # If area overlap is significant (>50%), skip it (it's likely part of the diagram text)
                is_duplicate = False
                for ir in ignore_rects:
                    intersect = block_bbox & ir # Intersection rect
                    if not intersect.is_empty:
                        overlap_area = intersect.width * intersect.height
                        block_area = block_bbox.width * block_bbox.height
                        # If more than 40% of the block is covered by the diagram, kill it
                        if block_area > 0 and (overlap_area / block_area) > 0.4:
                            is_duplicate = True
                            break
                
                if is_duplicate:
                    # print("   ⛔ Skipping text block (inside diagram)")
                    continue

                # --- IMAGES (Raster) ---
                if block["type"] == 1: 
                    bbox = fitz.Rect(block["bbox"])
                    if bbox.width < 150 or bbox.height < 150: continue
                    if (bbox.width * bbox.height) > (page_rect.width * page_rect.height * 0.9): continue

                    try:
                        mat = fitz.Matrix(2.0, 2.0) 
                        pix = page.get_pixmap(matrix=mat, clip=bbox)
                        if pix.alpha: pix = fitz.Pixmap(pix, 0) 

                        filename = f"{book_id}/{chapter_id}_{global_order_index}.png"
                        supabase.storage.from_("book-assets").upload(
                            path=filename, file=pix.tobytes("png"),
                            file_options={"content-type": "image/png", "upsert": "true"}
                        )
                        public_url = supabase.storage.from_("book-assets").get_public_url(filename)
                        
                        paragraphs_to_insert.append({
                            "chapter_id": chapter_id, 
                            "content": public_url, 
                            "type": "image",
                            "order_index": global_order_index, 
                            "section_title": current_section, 
                            "is_completed": False
                        })
                        global_order_index += 1
                    except Exception: pass

                # --- TEXT ---
                elif block["type"] == 0:
                    block_text = ""
                    is_header = False
                    is_code_block = False
                    
                    for line in block["lines"]:
                        line_text = ""
                        for span in line["spans"]:
                            span_text = span["text"]
                            font_name = span["font"].lower()
                            
                            # DEBUG: Trace fonts to fix detection
                            # if page_num == start_idx: print(f"   [Font Trace] {font_name}: {span_text[:20]}")

                            # Check for Code Font (Heuristic 1: Font Name)
                            if "mono" in font_name or "courier" in font_name or "consolas" in font_name or "typewriter" in font_name:
                                is_code_block = True
                            
                            # Check for Code Syntax (Heuristic 2: C-Style Endings)
                            # If a line ends with ; or { or }, it's likely code. 
                            if span_text.strip().endswith((";", "{", "}", "*/")):
                                is_code_block = True

                            # Check if text might be reversed (common PDF issue)
                            # SKIP if it looks like a formula (has = or * or /)
                            is_math_part = any(op in span_text for op in ["=", "*", "/", "+"])
                            
                            if len(span_text) > 3 and not is_math_part:
                                reversed_text = span_text[::-1]
                                common_words = [
                                    'the', 'and', 'is', 'are', 'of', 'in', 'to', 'for', 'that', 'with', 'from', 'have', 'this', 'what', 'separation', 'process', 'substance', 'change', 'describe',
                                    'int', 'float', 'char', 'void', 'main', 'printf', 'scanf', 'include', 'return', 'if', 'else', 'while', 'for', 'switch', 'case', 'break', 'continue', 'struct', 'union', 'typedef', 'define', 'header', 'stdio'
                                ] 
                                original_matches = sum(1 for w in common_words if w in span_text.lower())
                                reversed_matches = sum(1 for w in common_words if w in reversed_text.lower())
                                
                                if reversed_matches > original_matches:
                                    span_text = reversed_text
                                    
                            line_text += span_text + " "
                            if span["size"] > 14: is_header = True
                        
                        # Use newline for code, space for regular text (within a block)
                        if is_code_block:
                            block_text += line_text.strip() + "\n"
                        else:
                            # New MATH Detection for individual lines
                            clean_line = line_text.strip()
                            # Heuristic: Contains = AND some math operator OR typical tokens
                            is_math_line = False
                            if "=" in clean_line and len(clean_line) < 100:
                                if any(op in clean_line for op in ["+", "*", "/", "^", "\\", "{", "}"]):
                                    is_math_line = True
                                elif re.search(r'\b(si|p|n|r|x|y|f\(x\))\b', clean_line): # Variable heuristics
                                    is_math_line = True
                            
                            # If it looks like a formula, wrap it immediately for this line
                            if is_math_line and not is_header:
                                # Quote it as latex
                                block_text += "$$ " + clean_line.replace("$$", "") + " $$\n"
                            else:
                                block_text += line_text
                    
                    clean_text = block_text.strip()
                    if not clean_text or len(clean_text) < 3: continue

                    if is_header: 
                        current_section = clean_text[:60] # Update Context
                    
                    # Wrap Code Blocks
                    if is_code_block and not is_header:
                        # Clean up any potential double wrapping if logic expands
                        clean_text = f"```c\n{clean_text}\n```"

                    # Merge logic
                    if not is_header and paragraphs_to_insert:
                        last_para = paragraphs_to_insert[-1]
                        
                        should_merge = False
                        
                        # --- MERGE CODE BLOCKS ---
                        if is_code_block and last_para["content"].startswith("```c"):
                             # Merge two code blocks
                            last_para["content"] = last_para["content"].replace("\n```", "") + "\n" + clean_text.replace("```c\n", "").replace("\n```", "") + "\n```"
                            continue # Merged
                        
                        # --- MERGE TEXT BLOCKS ---
                        elif not is_code_block and not last_para["content"].startswith("```c"):
                            # Don't merge distinct Math blocks into text blindly? 
                            # Actually it's fine, Markdown renders matched $$ blocks inline or block even if inside a paragraph.
                            # But let's separate them if it's a BIG math block.
                            
                            if last_para["type"] == "image": should_merge = False
                            elif last_para["section_title"] != current_section: should_merge = False 
                            # If new text is purely math ($$ ... $$), maybe keep it separate?
                            elif clean_text.startswith("$$") and clean_text.endswith("$$"): should_merge = False
                            
                            elif len(clean_text) < 300: should_merge = True 
                            elif not last_para["content"].strip().endswith((".", "!", "?", ":")): should_merge = True 
                            
                            if should_merge and len(last_para["content"]) < 2000:
                                last_para["content"] += " " + clean_text
                                continue 
                    
                    type_label = "header" if is_header else "text"

                    paragraphs_to_insert.append({
                        "chapter_id": chapter_id, 
                        "content": clean_text, 
                        "type": type_label, 
                        "order_index": global_order_index, 
                        "section_title": current_section, 
                        "is_completed": False
                    })
                    global_order_index += 1

        if paragraphs_to_insert:
            chunk_size = 100
            for i in range(0, len(paragraphs_to_insert), chunk_size):
                supabase.table("paragraphs").insert(paragraphs_to_insert[i:i+chunk_size]).execute()

        print(f"✅ Generated Chapter: {chapter.data['title']}")

    except Exception as e:
        print(f"❌ Error generating chapter: {str(e)}")
class TTSRequest(BaseModel):
    text: str
    language: str = "english" # english, hindi, spanish, chinese

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