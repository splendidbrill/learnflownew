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

# --- AI & DB IMPORTS ---
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
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

app.include_router(scheduler.router, prefix="/api")
app.include_router(stats.router, prefix="/api")

# --- 3. SETUP AZURE DEEPSEEK (TEXT BRAIN) ---
azure_base_url = os.getenv("AZURE_BASE_URL")
azure_api_key = os.getenv("AZURE_API_KEY")
text_model_name = os.getenv("AZURE_TEXT_MODEL") # e.g. DeepSeek-R1

if not azure_api_key:
    print("⚠️ AZURE CREDENTIALS MISSING. Check .env file.")

# Initialize Azure DeepSeek
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

# --- HEALTH CHECK ---
@app.get("/")
def health_check():
    return {"status": "active", "message": "Local Backend Online 🏠"}

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
    print(f"👁️ Analyzing Image: {req.paragraphId}")
    existing = supabase.table("paragraphs").select("explanation").eq("id", req.paragraphId).single().execute()
    if existing.data and existing.data.get("explanation"):
        return {"explanation": existing.data["explanation"]}

    explanation = await analyze_diagram(req.imageUrl, req.analogyTopic)

    if "couldn't analyze" not in explanation and "Error" not in explanation:
        supabase.table("paragraphs").update({"explanation": explanation}).eq("id", req.paragraphId).execute()

    return {"explanation": explanation}

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    # Setup Context
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
                1. If user says "Start/Yes/Explain", explain text using analogies. End with: "Any questions, or shall we move on?"
                2. If user asks question, answer based on TEXT.
                3. ONLY if user says "Next/Yes/Ok" (agreeing to move), reply ONLY: "[NEXT]"
                """
        except Exception:
            pass

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
    print(f"👉 Generating Content for: {req.chapterId}")
    background_tasks.add_task(process_chapter_content, req.chapterId)
    return {"status": "started"}

# --- WORKERS (Local Processing) ---

async def process_book(book_id: str, file_url: str, interest: str, book_type: str):
    print(f"🚀 Scanning Book Structure (DeepSeek)...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(file_url)
            pdf_bytes = resp.content
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        # 1. Try Metadata first
        toc = doc.get_toc() 
        chapters_to_save = []
        offset = 0
        metadata_chapters = [t for t in toc if t[0] == 1]

        if len(metadata_chapters) > 3:
            print(f"⚡ Found {len(metadata_chapters)} chapters via Metadata.")
            for t in metadata_chapters:
                chapters_to_save.append({"title": t[1], "start_page": t[2]})
        else:
            # 2. Fallback to DeepSeek Scan
            print("⚠️ Metadata failed. Scanning with DeepSeek...")
            toc_text = ""
            for i in range(min(50, len(doc))):
                toc_text += doc[i].get_text() + "\n"

            prompt = f"""
            You are a JSON parser. Extract the Table of Contents.
            RULES: Extract Top-Level Chapters Only (e.g. "Chapter 1", "1. Motion"). IGNORE sub-sections.
            Return JSON: {{ "chapters": [ {{ "title": "...", "start_page": 5 }} ] }}
            TEXT: {toc_text[:60000]}...
            """
            ai_response = llm.invoke(prompt)
            json_match = re.search(r"\{.*\}", ai_response.content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                chapters_to_save = data.get("chapters", [])
                # Offset calc logic...
                if len(chapters_to_save) > 0:
                    c_title = chapters_to_save[0]['title'].lower().split(" ")[0]
                    printed = chapters_to_save[0].get('start_page', 1)
                    for i in range(min(60, len(doc))):
                        if c_title in doc[i].get_text().lower():
                            if "contents" in doc[i].get_text().lower(): continue
                            offset = i - (printed - 1)
                            break

        if not chapters_to_save:
            print("❌ No chapters found.")
            supabase.table("course_books").update({"status": "failed"}).eq("id", book_id).execute()
            return

        supabase.table("chapters").delete().eq("book_id", book_id).execute()
        for i, chap in enumerate(chapters_to_save):
            supabase.table("chapters").insert({
                "book_id": book_id, "title": chap['title'],
                "order_index": i + 1, "start_page_num": chap.get('start_page', 0) + offset
            }).execute()

        supabase.table("course_books").update({"status": "completed"}).eq("id", book_id).execute()
        print("✅ Scan Complete.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        supabase.table("course_books").update({"status": "failed"}).eq("id", book_id).execute()

async def process_chapter_content(chapter_id: str):
    print(f"⚡ Processing Chapter: {chapter_id}")
    
    try:
        # 1. Setup
        chapter = supabase.table("chapters").select("*").eq("id", chapter_id).single().execute()
        book_id = chapter.data['book_id']
        start_page = chapter.data['start_page_num']
        
        book = supabase.table("course_books").select("file_url").eq("id", book_id).single().execute()
        async with httpx.AsyncClient() as client:
            resp = await client.get(book.data['file_url'])
            pdf_bytes = resp.content
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        # End Page Logic
        next_chap = supabase.table("chapters").select("start_page_num").eq("book_id", book_id).gt("order_index", chapter.data['order_index']).order("order_index").limit(1).execute()
        if next_chap.data:
            end_page = next_chap.data[0]['start_page_num']
        else:
            end_page = len(doc)

        if (end_page - start_page) > 30: end_page = start_page + 30
        if end_page <= start_page: end_page = start_page + 1

        print(f"📖 Reading pages {start_page} to {end_page}")

        supabase.table("paragraphs").delete().eq("chapter_id", chapter_id).execute()

        global_order_index = 1
        current_section = "General"
        paragraphs_to_insert = []

        # 3. Iterate Pages
        start_idx = start_page - 1
        end_idx = end_page - 1
        if end_idx > len(doc): end_idx = len(doc)

        for page_num in range(start_idx, end_idx):
            page = doc[page_num]
            page_width = page.rect.width
            page_height = page.rect.height
            
            # Use 'dict' for text structure
            text_blocks = page.get_text("dict")["blocks"]
            
            # --- 1. PROCESS TEXT FIRST ---
            for block in text_blocks:
                if block["type"] == 0:
                    block_text = ""
                    is_header = False
                    for line in block["lines"]:
                        for span in line["spans"]:
                            block_text += span["text"] + " "
                            if span["size"] > 14: is_header = True
                    
                    clean = block_text.strip()
                    if len(clean) > 3:
                        if is_header: current_section = clean[:50]
                        paragraphs_to_insert.append({
                            "chapter_id": chapter_id, "content": clean, 
                            "type": "header" if is_header else "text",
                            "order_index": global_order_index, "section_title": current_section, "is_completed": False
                        })
                        global_order_index += 1

            # --- 2. PROCESS IMAGES (SNAPSHOT METHOD) ---
            # We look for image locations
            image_list = page.get_images(full=True)
            
            for img_idx, img in enumerate(image_list):
                xref = img[0]
                
                try:
                    # Get the rectangle where the image is drawn
                    rects = page.get_image_rects(xref)
                    if not rects: continue
                    bbox = rects[0] # Use first occurrence
                    
                    width = bbox.width
                    height = bbox.height

                    # --- FILTERING (Crucial) ---
                    # 1. Skip Tiny Icons
                    if width < 150 or height < 150: continue
                    
                    # 2. Skip "Whole Page" Backgrounds
                    # If image is > 90% of page size, it's likely a watermark or background color
                    if (width * height) > (page_width * page_height * 0.90): 
                        continue

                    # --- SNAPSHOT & COLOR FIX ---
                    # Matrix 2.0 = High Res
                    mat = fitz.Matrix(2.0, 2.0)
                    pix = page.get_pixmap(matrix=mat, clip=bbox)

                    # FORCE WHITE BACKGROUND (Fixes Black Transparent Images)
                    if pix.alpha:
                        pix_white = fitz.Pixmap(fitz.csRGB, pix.width, pix.height)
                        pix_white.clearWith(255, 255, 255) # Fill White
                        pix_white.set_origin(pix.x, pix.y)
                        pix_white.copy(pix, pix.rect) # Overlay image
                        pix = pix_white

                    png_bytes = pix.tobytes("png")
                    
                    # Upload
                    filename = f"{book_id}/{chapter_id}_{page_num}_{img_idx}.png"
                    supabase.storage.from_("book-assets").upload(
                        path=filename, file=png_bytes,
                        file_options={"content-type": "image/png", "upsert": "true"}
                    )
                    public_url = supabase.storage.from_("book-assets").get_public_url(filename)
                    
                    paragraphs_to_insert.append({
                        "chapter_id": chapter_id, "content": public_url, "type": "image",
                        "order_index": global_order_index, "section_title": current_section, "is_completed": False
                    })
                    global_order_index += 1

                except Exception as e:
                    print(f"⚠️ Image skip: {e}")

        # 4. Save
        if paragraphs_to_insert:
            # Sort by sequence (Images might be processed after text on same page, 
            # ideally we sort by Y-coordinate but sequence is acceptable for MVP)
            # To be safer, we could collect all (text+img) with Y-pos and sort.
            
            print(f"💾 Saving {len(paragraphs_to_insert)} items...")
            chunk_size = 100
            for i in range(0, len(paragraphs_to_insert), chunk_size):
                supabase.table("paragraphs").insert(paragraphs_to_insert[i:i+chunk_size]).execute()

        print(f"✅ Generated Chapter: {chapter.data['title']}")

    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)