import os
import fitz # PyMuPDF
import re
import json
import httpx
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# --- IMPORTS ---
from langchain_openai import ChatOpenAI 
from langchain_core.messages import HumanMessage, SystemMessage
from db import supabase 
from services.vision_service import analyze_diagram
from routers import scheduler, stats

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

# --- ENDPOINTS ---

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

# 👁️ B. DIAGRAM EXPLAINER (Context Aware)
@app.post("/api/analyze-image")
async def analyze_image_endpoint(req: ImageAnalysisRequest):
    print(f"👁️ Analyze Request | Context: {req.context}")

    # Check Cache
    existing = supabase.table("paragraphs").select("explanation").eq("id", req.paragraphId).single().execute()
    if existing.data and existing.data.get("explanation"):
        return {"explanation": existing.data["explanation"]}

    # Call Vision Service (Context is crucial here)
    explanation = await analyze_diagram(req.imageUrl, req.analogyTopic, req.context)

    # Save to DB
    if "Error" not in explanation:
        supabase.table("paragraphs").update({
            "explanation": explanation,
            "analogy_topic": req.analogyTopic
        }).eq("id", req.paragraphId).execute()

    return {"explanation": explanation}

# 💬 C. CHAT & PROGRESS
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    system_context = "You are a helpful AI Tutor."
    
    if req.currentParagraphId:
        try:
            para_res = supabase.table("paragraphs").select("content, section_title").eq("id", req.currentParagraphId).single().execute()
            if para_res.data:
                para_content = para_res.data['content']
                section_title = para_res.data.get('section_title', 'General Section')
                
                system_context = f"""
                You are an expert AI Tutor.
                CURRENT FOCUS: {section_title}
                TEXT: "{para_content}"
                
                INSTRUCTIONS:
                1. EXPLAIN: Use simple analogies.
                2. MOVEMENT: If user says "Next" or "Got it", reply ONLY: "[NEXT]"
                """
        except Exception: pass

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
            
            # Progress Tracking
            if "[NEXT]" in full_response:
                supabase.table("user_progress").upsert({
                    "user_id": req.userId,
                    "book_id": req.bookId,
                    "current_block_id": req.currentParagraphId,
                    "is_completed": True,
                    "updated_at": "now()"
                }).execute()
        except Exception as e:
            yield f"Error: {str(e)}"

    return StreamingResponse(response_generator(), media_type="text/plain")

@app.post("/ingest")
async def ingest_book(req: IngestRequest, background_tasks: BackgroundTasks):
    supabase.table("course_books").update({"status": "processing"}).eq("id", req.bookId).execute()
    background_tasks.add_task(process_book, req.bookId, req.fileUrl, req.interest, req.bookType)
    return {"status": "processing_started"}

@app.post("/generate_chapter")
async def generate_chapter(req: GenerateChapterRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_chapter_content, req.chapterId)
    return {"status": "started", "message": "Generating..."}

# --- BACKGROUND WORKERS (THE LOGIC ENGINE) ---

# --- ROBUST PROCESS BOOK (Copy into main.py) ---

async def process_book(book_id: str, file_url: str, interest: str, book_type: str):
    print(f"🚀 Starting Scan for Book: {book_id}")
    supabase.table("course_books").update({"status": "processing"}).eq("id", book_id).execute()
    
    try:
        # 1. Download & Open PDF
        async with httpx.AsyncClient() as client:
            resp = await client.get(file_url)
            pdf_bytes = resp.content
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        chapters_to_save = []
        pdf_offset = 0

        # 2. Try Metadata TOC
        toc = doc.get_toc() 
        print(f"📋 Metadata found {len(toc)} entries.")

        if len(toc) > 0:
            # Filter for likely chapters (Level 1 or titles starting with 'Chapter'/'Unit')
            # If standard Level 1 search yields nothing, take ALL levels
            metadata_chapters = [t for t in toc if t[0] == 1]
            if not metadata_chapters:
                metadata_chapters = toc # Fallback: Take everything if hierarchy is broken

            # --- SMART OFFSET CALIBRATION ---
            # Try to align PDF Page Number with Printed Page Number
            try:
                # Look at the first valid chapter
                valid_chaps = [c for c in metadata_chapters if "content" not in c[1].lower()]
                if valid_chaps:
                    target = valid_chaps[0]
                    title_stub = target[1][:20].strip() # Take first 20 chars (e.g., "Chapter 1")
                    printed_page = target[2]
                    
                    print(f"🔎 Calibrating offset using: '{title_stub}' (Meta Pg: {printed_page})")

                    # Search +/- 15 pages around the metadata target
                    start_search = max(0, printed_page - 15)
                    end_search = min(len(doc), printed_page + 15)
                    
                    for i in range(start_search, end_search):
                        page_text = doc[i].get_text().lower()
                        # Fuzzy match: is the title in the first 500 chars of the page?
                        if title_stub.lower() in page_text[:800]:
                            found_page = i + 1
                            pdf_offset = found_page - printed_page
                            print(f"🎯 Offset Found: {pdf_offset} (True Page: {found_page})")
                            break
            except Exception as e:
                print(f"⚠️ Offset calc failed (using 0): {e}")

            # Build list with calculated offset
            for t in metadata_chapters:
                chapters_to_save.append({
                    "title": t[1],
                    "start_page": max(1, t[2] + pdf_offset) # Ensure no negative pages
                })

        # 3. AI Fallback (If Metadata failed or returned 0 chapters)
        if not chapters_to_save:
            print("⚠️ Metadata useless. Scanning text with DeepSeek...")
            # Scan first 30 pages of text
            toc_text = ""
            for i in range(min(30, len(doc))):
                toc_text += f"[Page {i+1}]\n{doc[i].get_text()}\n"

            prompt = f"""
            Extract the Table of Contents from this book text.
            Text includes [Page X] markers.
            
            RULES:
            1. Find the Chapter Titles and their STARTING PAGE number.
            2. Ignore "Preface", "Copyright".
            3. Return JSON ONLY: {{ "chapters": [ {{ "title": "Chapter 1: Motion", "page_number": 5 }} ] }}
            
            TEXT:
            {toc_text[:15000]}...
            """
            
            try:
                ai_res = await llm.ainvoke([HumanMessage(content=prompt)])
                # Robust Regex to find JSON
                match = re.search(r"\{.*\}", ai_res.content, re.DOTALL)
                if match:
                    data = json.loads(match.group(0))
                    for c in data.get('chapters', []):
                        chapters_to_save.append({
                            "title": c['title'],
                            "start_page": c['page_number']
                        })
            except Exception as ai_err:
                print(f"❌ AI Scan failed: {ai_err}")

        # 4. Final Save to DB
        if not chapters_to_save:
            print("❌ CRITICAL: No chapters found via Metadata OR AI.")
            supabase.table("course_books").update({"status": "failed"}).eq("id", book_id).execute()
            return

        print(f"💾 Saving {len(chapters_to_save)} chapters...")
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
        print(f"❌ Global Error: {str(e)}")
        supabase.table("course_books").update({"status": "failed"}).eq("id", book_id).execute()

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
        
        if next_chap.data:
            end_page = next_chap.data[0]['start_page_num']
        else:
            end_page = len(doc)

        # Cap length for safety
        if (end_page - start_page) > 25: end_page = start_page + 25
        if end_page <= start_page: end_page = start_page + 1

        print(f"📖 Reading pages {start_page} to {end_page}")

        supabase.table("paragraphs").delete().eq("chapter_id", chapter_id).execute()

        global_order_index = 1
        current_section = chapter.data['title'] # Default context
        paragraphs_to_insert = []

        start_idx = start_page - 1
        end_idx = end_page - 1
        if end_idx > len(doc): end_idx = len(doc)

        for page_num in range(start_idx, end_idx):
            page = doc[page_num]
            page_rect = page.rect
            blocks = page.get_text("dict")["blocks"]
            
            for block in blocks:
                # --- IMAGES ---
                if block["type"] == 1: 
                    bbox = fitz.Rect(block["bbox"])
                    if bbox.width < 150 or bbox.height < 150: continue
                    if (bbox.width * bbox.height) > (page_rect.width * page_rect.height * 0.9): continue

                    try:
                        mat = fitz.Matrix(2.0, 2.0) # High quality for Vision
                        pix = page.get_pixmap(matrix=mat, clip=bbox)
                        if pix.alpha: pix = fitz.Pixmap(pix, 0) # Remove alpha

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
                            "section_title": current_section, # SAVE CONTEXT
                            "is_completed": False
                        })
                        global_order_index += 1
                    except Exception: pass

                # --- TEXT ---
                elif block["type"] == 0:
                    block_text = ""
                    is_header = False
                    for line in block["lines"]:
                        for span in line["spans"]:
                            block_text += span["text"] + " "
                            if span["size"] > 14: is_header = True
                    
                    clean_text = block_text.strip()
                    if not clean_text: continue

                    if is_header: 
                        current_section = clean_text[:60] # Update Context
                    
                    # We store as 'text' or 'header' to satisfy DB Constraints
                    # We will detect 'example' patterns later in Python
                    type_label = "header" if is_header else "text"

                    paragraphs_to_insert.append({
                        "chapter_id": chapter_id, 
                        "content": clean_text, 
                        "type": type_label, 
                        "order_index": global_order_index, 
                        "section_title": current_section, # SAVE CONTEXT
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)