

import os
import fitz
import time
import re
import json
import ast
import httpx # <--- Make sure this is imported
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List


# --- IMPORTS ---
from langchain_community.document_loaders import PyPDFLoader

from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, SystemMessage
# NEW: Use Groq instead of Google
from langchain_groq import ChatGroq 

from db import supabase 

# Import the new Router
from routers import scheduler, stats

# 1. Load Env
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI()

@app.get("/")
def health_check():
    return {"status": "active", "message": "LearnFlow Backend is Online 🚀"}

app.include_router(scheduler.router, prefix="/api")
app.include_router(stats.router, prefix="/api") 

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# 3. Config
url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
groq_key = os.environ.get("GROQ_API_KEY")

if not url or not key:
    raise ValueError("CRITICAL: Supabase URL/KEY missing.")
if not groq_key:
    raise ValueError("CRITICAL: GROQ_API_KEY missing.")

supabase: Client = create_client(url, key)

# Add this model at the top
class ImageAnalysisRequest(BaseModel):
    paragraphId: str
    imageUrl: str
    analogyTopic: str


@app.post("/api/analyze-image")
async def analyze_image_endpoint(req: ImageAnalysisRequest):
    print(f"👁️ Analyzing Image for Para: {req.paragraphId}")

    # 1. Check Cache
    existing = supabase.table("paragraphs").select("explanation").eq("id", req.paragraphId).single().execute()
    if existing.data and existing.data.get("explanation"):
        return {"explanation": existing.data["explanation"]}

    # 2. Setup SPECIFIC Vision Model (Llama 3.2 90B Vision)
    # We create this client ONLY when needed
    vision_llm = ChatGroq(
        model="llama-3.2-90b-vision-instruct", # <--- The dedicated Vision model
        api_key=groq_key,
        temperature=0.2
    )

    prompt = f"""
    You are a Physics Tutor. 
    Analyze this image. Explain the scientific concept visible here using a '{req.analogyTopic}' analogy.
    Keep it short, clear, and fun.
    """
    
    try:
        # Construct Message for Vision
        msg = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": req.imageUrl
                        }
                    }
                ]
            }
        ]
        
        # 3. Call the Vision Model
        response = vision_llm.invoke(msg)
        explanation = response.content

        # 4. Save to DB
        supabase.table("paragraphs").update({
            "explanation": explanation
        }).eq("id", req.paragraphId).execute()

        return {"explanation": explanation}

    except Exception as e:
        print(f"Vision Error: {e}")
        # Detailed error for debugging
        return {"explanation": f"I couldn't see the diagram clearly. (Error: {str(e)})"}

@app.on_event("startup")
async def set_telegram_webhook():
    """
    Automatically tells Telegram where to send messages when the server starts.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    app_url = os.getenv("APP_URL") # This is your Render URL

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

# 4. Setup AI (GROQ - Llama 3 8B)
# This model is Free, Fast, and Good at JSON.
# llm = ChatGroq(
#     model="llama-3.1-8b-instant", 
#     api_key=groq_key,
#     temperature=0.3
# )

llm = ChatGroq(
    model="llama-3.3-70b-versatile", # <--- Excellent for JSON & Text
    api_key=groq_key,
    temperature=0.1 # Low temp is better for strict JSON
)

class IngestRequest(BaseModel):
    bookId: str
    fileUrl: str
    interest: str
    bookType: str


# Define the structure we want the AI to return
class ParagraphObj(BaseModel):
    content: str
    type: str # 'text' or 'header'

class SectionObj(BaseModel):
    title: str
    paragraphs: List[str]

class ChapterStructure(BaseModel):
    sections: List[SectionObj]

# ... imports (make sure json, ast, PyPDFLoader, etc. are imported) ...

# backend/main.py
import fitz # PyMuPDF (Make sure pymupdf is in requirements.txt)
import re
import json

async def process_book(book_id: str, file_url: str, interest: str, book_type: str):
    print(f"🚀 Starting Structure Scan for Book: {book_id}")
    supabase.table("course_books").update({"status": "processing"}).eq("id", book_id).execute()
    
    try:
        # 1. Download PDF
        async with httpx.AsyncClient() as client:
            resp = await client.get(file_url)
            pdf_bytes = resp.content

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # 2. Extract ToC Text (First 20 pages)
        toc_text = ""
        for i in range(min(20, len(doc))):
            toc_text += doc[i].get_text() + "\n"

        # 3. AI: Extract Chapters & Printed Page Numbers
        prompt = f"""
        You are a JSON parser. Extract the Table of Contents.
        
        RULES:
        1. Return a JSON object with a "chapters" list.
        2. Each chapter: {{ "title": "Chapter Name", "start_page": 5 }}
        3. 'start_page' must be the NUMBER printed in the book, not the PDF page index.
        
        TEXT:
        {toc_text[:15000]}...
        
        OUTPUT JSON:
        """
        
        # Use Global Text LLM
        ai_response = llm.invoke(prompt)
        
        # Extract JSON
        json_match = re.search(r"\{.*\}", ai_response.content, re.DOTALL)
        if not json_match: raise ValueError("No JSON found")
        data = json.loads(json_match.group(0))
        chapters_list = data.get("chapters", [])

        # --- 4. SMART OFFSET CALCULATION (The Fix) ---
        offset = 0
        if chapters_list:
            first_chap_title = chapters_list[0]['title']
            printed_start = chapters_list[0].get('start_page', 1)
            
            print(f"🕵️ Looking for Chapter 1: '{first_chap_title}' to calculate offset...")
            
            # Scan first 50 pages to find where Chapter 1 actually starts
            found_page_idx = -1
            for i in range(min(50, len(doc))):
                page_text = doc[i].get_text().lower()
                # Clean title for comparison
                clean_title = first_chap_title.lower().replace("chapter", "").strip()
                
                # Check if title matches reasonably well
                if clean_title in page_text:
                    found_page_idx = i
                    break
            
            if found_page_idx != -1:
                # Calculate Offset: Actual PDF Page - Printed Page
                # Example: Found on Index 14 (Page 15), Printed is 1. Offset = 14.
                offset = found_page_idx - (printed_start - 1) 
                print(f"🎯 Found Chapter 1 at PDF Page {found_page_idx}. Printed Page {printed_start}. Offset: {offset}")
            else:
                print("⚠️ Could not find Chapter 1 title. Assuming Offset = 0 (Risky)")

        # 5. Save to DB with Corrected Pages
        supabase.table("chapters").delete().eq("book_id", book_id).execute()

        for i, chap in enumerate(chapters_list):
            raw_page = chap.get('start_page', 0)
            # Apply Offset
            corrected_page = raw_page + offset
            
            supabase.table("chapters").insert({
                "book_id": book_id,
                "title": chap['title'],
                "order_index": i + 1,
                "start_page_num": corrected_page # <--- SAVING REAL PDF PAGE
            }).execute()

        supabase.table("course_books").update({"status": "completed"}).eq("id", book_id).execute()
        print(f"✅ Scan Complete. Offset applied: {offset}")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        supabase.table("course_books").update({"status": "failed"}).eq("id", book_id).execute()
    
        


@app.post("/ingest")
async def ingest_book(req: IngestRequest, background_tasks: BackgroundTasks):
    # Update 'course_books' immediately
    supabase.table("course_books").update({"status": "processing"}).eq("id", req.bookId).execute()
    
    background_tasks.add_task(process_book, req.bookId, req.fileUrl, req.interest, req.bookType)
    return {"status": "processing_started"}

# ... imports ...


# 1. NEW ENDPOINT
class GenerateChapterRequest(BaseModel):
    chapterId: str

# --- NEW: CHAT ENDPOINT MODELS & LOGIC ---
@app.post("/generate_chapter")
async def generate_chapter(req: GenerateChapterRequest, background_tasks: BackgroundTasks):
    print(f"👉 Endpoint hit! Requesting generation for: {req.chapterId}")
    # This calls the function we just updated
    background_tasks.add_task(process_chapter_content, req.chapterId)
    return {"status": "started", "message": "Generating chapter content..."}

class ChatRequest(BaseModel):
    messages: list
    chapterId: str
    currentParagraphId: str | None = None  # Use | None for optional in Python 3.10+
    userResponse: str = ""

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    print(f"💬 Chat Request for Paragraph: {req.currentParagraphId}")

    # 1. SETUP THE CONTEXT
    # Inside chat_endpoint in main.py

    # 1. SETUP THE CONTEXT
    system_context = "You are a helpful AI Tutor."
    
    # If we are focused on a specific paragraph, fetch it!
    if req.currentParagraphId:
        try:
            # A. Fetch Paragraph Content
            para_res = supabase.table("paragraphs").select("content, section_title").eq("id", req.currentParagraphId).single().execute()
            
            if para_res.data:
                para_content = para_res.data['content']
                section_title = para_res.data.get('section_title', 'General Section')

                # B. Fetch User Interests 
                # (Ideally passed from frontend, but hardcoded fallback for MVP safety)
                interests = ["Football", "Tech"] 

                # C. Construct the "Tutor" System Prompt
                # ... inside chat_endpoint ...

                # C. Construct the "Tutor" System Prompt
                system_context = f"""
                You are an expert AI Tutor.
                
                CURRENT FOCUS:
                Section: {section_title}
                Text: "{para_content}"
                
                USER PROFILE:
                Interests: {', '.join(interests)}
                
                INSTRUCTIONS:
                1. EXPLANATION MODE (Triggered by "Explain"):
                   - Explain the 'Text' using a metaphor related to {interests[0]}.
                   - Keep it concise.
                   - End with: "Any questions, or shall we move to the next paragraph?"
                
                2. Q&A MODE (Triggered by user questions):
                   - If the user asks "What is...", "Why...", "How...", or ANY question about the content:
                   - Answer strictly based on the 'Text'.
                   - Do NOT output [NEXT].
                   - After answering, ask: "Does that clarify it? Ready for the next paragraph?"
                
                3. MOVEMENT MODE (Triggered by agreement):
                   - ONLY if the user says "Yes", "Next", "Ok", "Clear", or "Go ahead" (indicating they are done with THIS paragraph):
                   - Reply with exactly: "[NEXT]"
                   - Do not output anything else.
                """
                
                # 4. QUIZ: If the user says "Quiz me", ask 1 multiple-choice question.
                # """
        except Exception as e:
            print(f"⚠️ Error fetching paragraph context: {e}")
            system_context = "You are an AI Tutor. I am having trouble reading the specific paragraph, so I will answer generally."

    # 2. PREPARE MESSAGES FOR AI
    langchain_messages = [SystemMessage(content=system_context)]
    
    for msg in req.messages:
        if msg.get('role') == 'user':
            langchain_messages.append(HumanMessage(content=msg.get('content')))

    # 3. STREAMING GENERATOR
    async def response_generator():
        try:
            # Make sure 'llm' is defined in your global scope (it is, from lines 54-58)
            async for chunk in llm.astream(langchain_messages):
                yield chunk.content
        except Exception as e:
            yield f"Error generating response: {str(e)}"

    return StreamingResponse(response_generator(), media_type="text/plain")

# ---------------------------------------------------------
# ... process_book and process_chapter_content go below here ...

# @app.post("/generate_chapter")
# async def generate_chapter(req: GenerateChapterRequest, background_tasks: BackgroundTasks):
#     background_tasks.add_task(process_chapter_content, req.chapterId)
#     return {"status": "started", "message": "Generating chapter content..."}

# 2. THE LOGIC
# async def process_chapter_content(chapter_id: str):
#     print(f"⚡ Generating granular structure for Chapter ID: {chapter_id}")
    
#     try:
#         # 1. Fetch Chapter Info
#         chapter = supabase.table("chapters").select("*").eq("id", chapter_id).single().execute()
#         chap_data = chapter.data
#         book_id = chap_data['book_id']
#         start_page = chap_data['start_page_num']
        
#         # 2. Fetch File URL
#         book = supabase.table("course_books").select("file_url").eq("id", book_id).single().execute()
#         file_url = book.data['file_url']

#         # 3. Determine End Page
#         next_chap = supabase.table("chapters")\
#             .select("start_page_num")\
#             .eq("book_id", book_id)\
#             .gt("order_index", chap_data['order_index'])\
#             .order("order_index")\
#             .limit(1)\
#             .execute()

#         end_page = next_chap.data[0]['start_page_num'] if next_chap.data else start_page + 20
#         print(f"📖 Reading pages {start_page} to {end_page}...")

#         # 4. Load & Extract Text
#         loader = PyPDFLoader(file_url)
#         all_pages = loader.load()
        
#         total_pages = len(all_pages)
#         start_idx = max(0, start_page - 1)
#         end_idx = min(total_pages, end_page - 1)
#         chapter_pages = all_pages[start_idx:end_idx]
#         chapter_text = "\n".join([p.page_content for p in chapter_pages])
        
#         if not chapter_text:
#             print("⚠️ Warning: Extracted text is empty.")
#             return

#         # 5. INTELLIGENT PARSING (Updated for Stability)
#         # Reduced chunk size to 4000 to prevent JSON syntax errors
#         text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200)
#         raw_chunks = text_splitter.split_text(chapter_text)

#         global_order_index = 1

#         for raw_chunk in raw_chunks:
#             # We explicitly ask for "Strict JSON" and escaping
#             prompt = f"""
#             You are a rigorous data parser. Convert the text below into strict JSON.
            
#             RULES:
#             1. Identify Section Headers (e.g., "**Title**") or use "General" if none.
#             2. Split text into paragraphs.
#             3. ESCAPE all double quotes inside the text (e.g. " becomes \").
#             4. Do NOT use trailing commas.
#             5. Return ONLY valid JSON.
            
#             RAW TEXT:
#             {raw_chunk}

#             JSON STRUCTURE:
#             {{
#                 "sections": [
#                     {{
#                         "title": "Section Name",
#                         "paragraphs": ["Para 1 content...", "Para 2 content..."]
#                     }}
#                 ]
#             }}
#             """
            
#             response = llm.invoke(prompt)
#             clean_content = response.content

#             # Helper: Try to clean common JSON errors from LLMs
#             try:
#                 # Find the JSON object
#                 json_match = re.search(r"\{.*\}", clean_content, re.DOTALL)
#                 if json_match:
#                     json_str = json_match.group(0)
#                     # Attempt to parse
#                     data = json.loads(json_str)
                    
#                     sections = data.get('sections', [])

#                     for section in sections:
#                         sec_title = section.get('title', 'General')
#                         for para_text in section.get('paragraphs', []):
#                             supabase.table("paragraphs").insert({
#                                 "chapter_id": chapter_id,
#                                 "content": para_text,
#                                 "section_title": sec_title,
#                                 "order_index": global_order_index,
#                                 "type": "text",
#                                 "is_completed": False
#                             }).execute()
#                             global_order_index += 1
#                 else:
#                     raise ValueError("No JSON found")
                            
#             except Exception as parse_e:
#                 print(f"⚠️ JSON Parse Error: {parse_e}")
#                 print(f"⚠️ Raw Response start: {clean_content[:100]}...")
                
#                 # FALLBACK: Save the raw text so the user doesn't see nothing
#                 supabase.table("paragraphs").insert({
#                     "chapter_id": chapter_id,
#                     "content": raw_chunk,
#                     "section_title": "General", # Fallback title
#                     "order_index": global_order_index,
#                     "type": "text",
#                     "is_completed": False
#                 }).execute()
#                 global_order_index += 1

#         print(f"✅ Granular processing complete for {chapter_id}")

#     except Exception as e:
#         print(f"❌ Critical Error: {str(e)}")


async def process_chapter_content(chapter_id: str):
    print(f"⚡ Processing Chapter: {chapter_id}")
    
    try:
        # 1. Fetch DB Info
        chapter = supabase.table("chapters").select("*").eq("id", chapter_id).single().execute()
        book_id = chapter.data['book_id']
        start_page = chapter.data['start_page_num']
        
        book = supabase.table("course_books").select("file_url").eq("id", book_id).single().execute()
        file_url = book.data['file_url']

        # Get End Page
        next_chap = supabase.table("chapters").select("start_page_num").eq("book_id", book_id).gt("order_index", chapter.data['order_index']).order("order_index").limit(1).execute()
        end_page = next_chap.data[0]['start_page_num'] if next_chap.data else start_page + 10

        print(f"📖 Reading from PDF: Page {start_page} to {end_page}")

        # 2. Download PDF
        async with httpx.AsyncClient() as client:
            resp = await client.get(file_url)
            pdf_bytes = resp.content

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Cleanup old paragraphs
        supabase.table("paragraphs").delete().eq("chapter_id", chapter_id).execute()

        global_order_index = 1
        current_section = "General"

        # 3. Iterate Pages (Fast Extraction)
        # Note: start_page from DB is 1-based. fitz is 0-based.
        for page_num in range(start_page - 1, min(end_page - 1, len(doc))):
            page = doc[page_num]
            blocks = page.get_text("dict")["blocks"]
            
            for block in blocks:
                
                # --- IMAGES ---
                if block["type"] == 1: 
                    # Skip tiny decorative images
                    if block["width"] < 150 or block["height"] < 150: continue

                    try:
                        ext = block["ext"]
                        image_bytes = block["image"]
                        filename = f"{book_id}/{chapter_id}_{global_order_index}.{ext}"
                        
                        # Upload
                        supabase.storage.from_("book-assets").upload(
                            path=filename, file=image_bytes,
                            file_options={"content-type": f"image/{ext}", "upsert": "true"}
                        )
                        public_url = supabase.storage.from_("book-assets").get_public_url(filename)
                        
                        # Save
                        supabase.table("paragraphs").insert({
                            "chapter_id": chapter_id, 
                            "content": public_url, 
                            "type": "image",
                            "order_index": global_order_index, 
                            "section_title": current_section,
                            "is_completed": False
                        }).execute()
                        global_order_index += 1
                    except Exception as img_err:
                        print(f"⚠️ Image skip: {img_err}")

                # --- TEXT ---
                elif block["type"] == 0:
                    block_text = ""
                    # Simple heuristic: If font is large (>14pt), it's a Header
                    is_header = False
                    
                    for line in block["lines"]:
                        for span in line["spans"]:
                            block_text += span["text"] + " "
                            if span["size"] > 14: # Font size threshold for headers
                                is_header = True
                    
                    clean_text = block_text.strip()
                    if not clean_text: continue

                    if is_header:
                        # Update current section tracker, but save as a paragraph too
                        current_section = clean_text[:50] # Limit length
                        
                        # Optional: Save header as its own block
                        supabase.table("paragraphs").insert({
                            "chapter_id": chapter_id, "content": clean_text, "type": "header",
                            "order_index": global_order_index, "section_title": current_section,
                            "is_completed": False
                        }).execute()
                    else:
                        # Regular Text
                        supabase.table("paragraphs").insert({
                            "chapter_id": chapter_id, "content": clean_text, "type": "text",
                            "order_index": global_order_index, "section_title": current_section,
                            "is_completed": False
                        }).execute()
                    
                    global_order_index += 1

        print(f"✅ Finished generating Chapter: {chapter.data['title']}")

    except Exception as e:
        print(f"❌ Error generating chapter: {str(e)}")


        
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)