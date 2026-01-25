import os
import fitz # PyMuPDF
import re
import json
import httpx
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# --- CHANGED: Use OpenAI Client (works for Azure) instead of Groq ---
from langchain_openai import ChatOpenAI 
from langchain_core.messages import HumanMessage, SystemMessage
from db import supabase 
from services.vision_service import analyze_diagram
from routers import scheduler, stats

# 1. Load Env
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# 2. Setup Middleware & Routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-frontend-url.vercel.app"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

app.include_router(scheduler.router, prefix="/api")
app.include_router(stats.router, prefix="/api")

# --- 3. SETUP AZURE LLM (TEXT BRAIN) ---
azure_base_url = os.getenv("AZURE_BASE_URL")
azure_api_key = os.getenv("AZURE_API_KEY")
text_model_name = os.getenv("AZURE_TEXT_MODEL")

if not azure_api_key or not azure_base_url:
    # Print warning but don't crash immediately (helpful for debugging)
    print("⚠️ AZURE CREDENTIALS MISSING. Check .env file.")

# Initialize Azure Client
try:
    llm = ChatOpenAI(
        model=text_model_name, 
        api_key=azure_api_key,
        base_url=azure_base_url,
        temperature=0.1,
        max_tokens=None,
        max_retries=2
    )
    print(f"✅ LLM Initialized: {text_model_name}")
except Exception as e:
    print(f"❌ Failed to initialize LLM: {e}")

# --- STARTUP HOOK (TELEGRAM) ---
@app.on_event("startup")
async def set_telegram_webhook():
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    app_url = os.getenv("APP_URL") 

    if not bot_token or not app_url:
        print("⚠️ Skipping Telegram Webhook setup: Missing secrets.")
        return

    webhook_url = f"{app_url}/api/hooks/telegram"
    telegram_api = f"https://api.telegram.org/bot{bot_token}/setWebhook"

    print(f"⚙️ Setting Telegram Webhook to: {webhook_url}")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(telegram_api, params={"url": webhook_url})
            if response.status_code == 200:
                print("✅ Telegram Webhook set successfully!")
            else:
                print(f"❌ Failed to set webhook: {response.text}")
        except Exception as e:
            print(f"❌ Error setting webhook: {e}")

# --- HEALTH CHECK ---
@app.get("/")
def health_check():
    return {"status": "active", "message": "LearnFlow Backend is Online 🚀"}

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

class ChatRequest(BaseModel):
    messages: list
    chapterId: str
    currentParagraphId: str | None = None 
    userResponse: str = ""

# --- ENDPOINTS ---

@app.post("/api/analyze-image")
async def analyze_image_endpoint(req: ImageAnalysisRequest):
    print(f"👁️ Analyzing Image for Para: {req.paragraphId}")

    # Check Cache
    existing = supabase.table("paragraphs").select("explanation").eq("id", req.paragraphId).single().execute()
    if existing.data and existing.data.get("explanation"):
        return {"explanation": existing.data["explanation"]}

    # Call Vision Service (Uses Azure DeepSeek from vision_service.py)
    explanation = await analyze_diagram(req.imageUrl, req.analogyTopic)

    # Save to DB
    if "couldn't analyze" not in explanation and "Error" not in explanation:
        supabase.table("paragraphs").update({
            "explanation": explanation
        }).eq("id", req.paragraphId).execute()

    return {"explanation": explanation}

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    print(f"💬 Chat Request for Paragraph: {req.currentParagraphId}")

    system_context = "You are a helpful AI Tutor."
    
    if req.currentParagraphId:
        try:
            para_res = supabase.table("paragraphs").select("content, section_title").eq("id", req.currentParagraphId).single().execute()
            
            if para_res.data:
                para_content = para_res.data['content']
                section_title = para_res.data.get('section_title', 'General Section')
                interests = ["Football", "Tech"] # Fallback

                system_context = f"""
                You are an expert AI Tutor.
                CURRENT FOCUS: {section_title}
                TEXT: "{para_content}"
                INTERESTS: {', '.join(interests)}
                
                INSTRUCTIONS:
                1. EXPLAIN: If user says "Start/Yes/Explain", explain text using {interests[0]} analogy. End with: "Any questions, or shall we move on?"
                2. Q&A: If user asks question, answer based on TEXT.
                3. MOVEMENT: ONLY if user says "Next/Yes/Ok" (agreeing to move), reply ONLY: "[NEXT]"
                """
        except Exception as e:
            print(f"⚠️ Error context: {e}")

    langchain_messages = [SystemMessage(content=system_context)]
    for msg in req.messages:
        if msg.get('role') == 'user':
            langchain_messages.append(HumanMessage(content=msg.get('content')))

    async def response_generator():
        try:
            async for chunk in llm.astream(langchain_messages):
                yield chunk.content
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
    print(f"👉 Endpoint hit! Requesting generation for: {req.chapterId}")
    background_tasks.add_task(process_chapter_content, req.chapterId)
    return {"status": "started", "message": "Generating..."}

# --- BACKGROUND WORKERS ---

async def process_book(book_id: str, file_url: str, interest: str, book_type: str):
    print(f"🚀 Starting Structure Scan for Book: {book_id}")
    supabase.table("course_books").update({"status": "processing"}).eq("id", book_id).execute()
    
    try:
        # 1. Download PDF
        async with httpx.AsyncClient() as client:
            resp = await client.get(file_url)
            pdf_bytes = resp.content
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        chapters_to_save = []
        offset = 0

        # --- PLAN A: METADATA EXTRACTION ---
        toc = doc.get_toc() 
        metadata_chapters = [t for t in toc if t[0] == 1]

        if len(metadata_chapters) > 3:
            print(f"⚡ Found {len(metadata_chapters)} chapters via PDF Metadata.")
            for t in metadata_chapters:
                chapters_to_save.append({
                    "title": t[1],
                    "start_page": t[2]
                })
            offset = 0 
        else:
            # --- PLAN B: AI EXTRACTION ---
            print("⚠️ No metadata found. Falling back to AI Scan...")
            toc_text = ""
            for i in range(min(50, len(doc))):
                toc_text += doc[i].get_text() + "\n"

            print(f"👀 AI Scanning text length: {len(toc_text)} chars")

            prompt = f"""
            You are a JSON parser. Extract the Table of Contents.
            RULES:
            1. Extract Top-Level Chapters Only.
            2. IGNORE sub-sections. 
            3. Return JSON: {{ "chapters": [ {{ "title": "...", "start_page": 5 }} ] }}
            
            TEXT: {toc_text[:60000]}...
            """
            
            ai_response = llm.invoke(prompt)
            json_match = re.search(r"\{.*\}", ai_response.content, re.DOTALL)
            
            if json_match:
                data = json.loads(json_match.group(0))
                chapters_to_save = data.get("chapters", [])
                
                # Calculate Offset
                if len(chapters_to_save) > 0:
                    chap1 = chapters_to_save[0]
                    c_title = chap1['title'].lower().replace("chapter", "").strip().split(" ")[0]
                    printed = chap1.get('start_page', 1)
                    
                    for i in range(min(60, len(doc))):
                        if c_title in doc[i].get_text().lower():
                            if "contents" in doc[i].get_text().lower(): continue
                            offset = i - (printed - 1)
                            print(f"🎯 AI Offset: {offset}")
                            break

        # Save Results
        if not chapters_to_save:
            print("❌ No chapters found.")
            supabase.table("course_books").update({"status": "failed"}).eq("id", book_id).execute()
            return

        supabase.table("chapters").delete().eq("book_id", book_id).execute()
        
        for i, chap in enumerate(chapters_to_save):
            raw_page = chap.get('start_page', 0)
            final_page = raw_page + offset
            
            supabase.table("chapters").insert({
                "book_id": book_id,
                "title": chap['title'],
                "order_index": i + 1,
                "start_page_num": final_page
            }).execute()

        supabase.table("course_books").update({"status": "completed"}).eq("id", book_id).execute()
        print(f"✅ Scan Complete. Saved {len(chapters_to_save)} chapters.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        supabase.table("course_books").update({"status": "failed"}).eq("id", book_id).execute()

async def process_chapter_content(chapter_id: str):
    print(f"⚡ Processing Chapter: {chapter_id}")
    
    try:
        # Fetch Info
        chapter = supabase.table("chapters").select("*").eq("id", chapter_id).single().execute()
        book_id = chapter.data['book_id']
        start_page = chapter.data['start_page_num']
        
        book = supabase.table("course_books").select("file_url").eq("id", book_id).single().execute()
        file_url = book.data['file_url']

        next_chap = supabase.table("chapters").select("start_page_num").eq("book_id", book_id).gt("order_index", chapter.data['order_index']).order("order_index").limit(1).execute()
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(file_url)
            pdf_bytes = resp.content
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        if next_chap.data:
            end_page = next_chap.data[0]['start_page_num']
        else:
            end_page = len(doc)

        if (end_page - start_page) > 30: 
            print(f"⚠️ Limit 30 pages.")
            end_page = start_page + 30
        
        if end_page <= start_page: end_page = start_page + 1

        print(f"📖 Reading pages {start_page} to {end_page}")

        supabase.table("paragraphs").delete().eq("chapter_id", chapter_id).execute()

        global_order_index = 1
        current_section = "General"
        paragraphs_to_insert = []

        # Iterate Pages
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
                    width, height = bbox.width, bbox.height

                    if width < 150 or height < 150: continue
                    if (width * height) > (page_rect.width * page_rect.height * 0.9): continue

                    try:
                        mat = fitz.Matrix(1.5, 1.5) 
                        pix = page.get_pixmap(matrix=mat, clip=bbox)
                        
                        filename = f"{book_id}/{chapter_id}_{global_order_index}.png"
                        supabase.storage.from_("book-assets").upload(
                            path=filename, file=pix.tobytes("png"),
                            file_options={"content-type": "image/png", "upsert": "true"}
                        )
                        public_url = supabase.storage.from_("book-assets").get_public_url(filename)
                        
                        paragraphs_to_insert.append({
                            "chapter_id": chapter_id, "content": public_url, "type": "image",
                            "order_index": global_order_index, "section_title": current_section, "is_completed": False
                        })
                        global_order_index += 1
                    except Exception as img_err:
                        print(f"⚠️ Image skip: {img_err}")

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

                    if is_header: current_section = clean_text[:50]
                    
                    paragraphs_to_insert.append({
                        "chapter_id": chapter_id, "content": clean_text, 
                        "type": "header" if is_header else "text",
                        "order_index": global_order_index, "section_title": current_section, "is_completed": False
                    })
                    global_order_index += 1

        if paragraphs_to_insert:
            print(f"💾 Saving {len(paragraphs_to_insert)} items...")
            chunk_size = 100
            for i in range(0, len(paragraphs_to_insert), chunk_size):
                supabase.table("paragraphs").insert(paragraphs_to_insert[i:i+chunk_size]).execute()

        print(f"✅ Generated Chapter: {chapter.data['title']}")

    except Exception as e:
        print(f"❌ Error generating chapter: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)