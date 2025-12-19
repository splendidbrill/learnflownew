# import os
# from dotenv import load_dotenv

# # Add 'Form' to this line
# from fastapi import FastAPI, HTTPException, File, UploadFile, Form
# from supabase import create_client, Client
# from pydantic import BaseModel
# from services.explainer import generate_explanation
# from fastapi import File, UploadFile
# from services.book_parser import parse_pdf_to_blocks

# # 1. Load the secrets from .env
# load_dotenv()

# # 2. Initialize the App
# app = FastAPI(title="LearnFlow API")

# # 3. Connect to Database
# url = os.environ.get("SUPABASE_URL")
# key = os.environ.get("SUPABASE_KEY")

# if not url or not key:
#     print("❌ ERROR: Missing Supabase URL or Key in .env file")
# else:
#     print("✅ Supabase Credentials Loaded")

# # Initialize Supabase Client
# try:
#     supabase: Client = create_client(url, key)
#     print("✅ Connected to Supabase")
# except Exception as e:
#     print(f"❌ Failed to connect to Supabase: {e}")

# # 4. The Health Check (To test if it works)
# @app.get("/")
# def read_root():
#     return {"status": "active", "message": "LearnFlow Backend is Online 🚀"}

# # 5. Test Database Connection Endpoint
# @app.get("/test-db")
# def test_db():
#     try:
#         # Fetch the first row from 'profiles' just to see if we can read data
#         response = supabase.table("profiles").select("*").limit(1).execute()
#         return {"db_status": "connected", "data": response.data}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# # --- NEW: AI Endpoint ---

# class ExplainRequest(BaseModel):
#     text: str
#     interests: list = ["general"]
#     book_type: str = "general"

# @app.post("/api/explain")
# def explain_text(request: ExplainRequest):
#     print(f"🧠 Generating explanation for: {request.book_type}")
    
#     result = generate_explanation(
#         content=request.text,
#         interests=request.interests,
#         book_type=request.book_type
#     )
    
#     return result

# # --- NEW: Upload Endpoint ---

# @app.post("/api/upload-book")
# async def upload_book(
#    title: str = Form(...),
#     user_id: str = Form(...), 
#     file: UploadFile = File(...)
# ):
#     print(f"📚 Uploading book: {title} for user {user_id}")
    
#     # 1. Read the file
#     content = await file.read()
    
#     # 2. Parse PDF
#     blocks = parse_pdf_to_blocks(content)
#     print(f"✅ Extracted {len(blocks)} paragraphs.")

#     # 3. Create Book Entry in Supabase
#     book_res = supabase.table("books").insert({
#         "user_id": user_id,
#         "title": title,
#         "total_blocks": len(blocks),
#         "processed": True
#     }).execute()
    
#     book_id = book_res.data[0]['id']

#     # 4. Save Blocks to Supabase
#     # We batch them to be faster (insert 50 at a time)
#     batch_size = 50
#     for i in range(0, len(blocks), batch_size):
#         batch = blocks[i:i + batch_size]
#         # Add book_id to every block
#         for block in batch:
#             block['book_id'] = book_id
#             # Remove page_number if your DB doesn't have that column, or add it to content
#             del block['page_number'] 
        
#         supabase.table("content_blocks").insert(batch).execute()
#         print(f"💾 Saved batch {i} to {i + len(batch)}")

#     return {"status": "success", "book_id": book_id, "blocks_count": len(blocks)}

# if __name__ == "__main__":
#     import uvicorn
#     # Run the server on port 8000
#     uvicorn.run(app, host="0.0.0.0", port=8000)

# backend/main.py
# import os
# import uuid
# from fastapi import FastAPI, HTTPException, File, UploadFile, Form
# from pydantic import BaseModel
# from dotenv import load_dotenv
# from supabase import create_client, Client
# from services.book_parser import parse_pdf_to_content
# from services.explainer import generate_explanation

# load_dotenv()

# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
#     raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")

# supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# app = FastAPI()

# @app.post("/api/upload-book")
# async def upload_book(
#     title: str = Form(...),
#     author: str = Form(None),
#     user_id: str = Form(...),
#     subject_id: str = Form(...),
#     file: UploadFile = File(...)
# ):
#     file_bytes = await file.read()
#     if not file_bytes:
#         raise HTTPException(status_code=400, detail="Empty file")

#     # parse PDF
#     parsed = parse_pdf_to_content(file_bytes)
#     if not parsed:
#         raise HTTPException(status_code=400, detail="Could not parse PDF or no text extracted")

#     # upload file to Supabase Storage (bucket: books)
#     storage_path = f"{user_id}/{uuid.uuid4().hex}_{file.filename}"
#     upload_res = supabase.storage.from_("books").upload(storage_path, file_bytes, {"contentType": "application/pdf", "upsert": True})
#     if upload_res.get("error"):
#         # upload error
#         raise HTTPException(status_code=500, detail=str(upload_res.get("error")))

#     # get public url
#     public_res = supabase.storage.from_("books").get_public_url(storage_path)
#     # supabase client returns either dict or object depending on SDK; handle commonly expected keys:
#     file_url = public_res.get("publicUrl") or public_res.get("public_url") or public_res

#     # insert book row
#     book_payload = {
#         "user_id": user_id,
#         "subject_id": subject_id,
#         "title": title,
#         "author": author or "Unknown",
#         "file_url": file_url,
#         "total_pages": parsed[-1]["page_number"] if parsed else 0
#     }
#     book_insert = supabase.table("books").insert(book_payload).select("*").execute()
#     if book_insert.error:
#         raise HTTPException(status_code=500, detail=f"Book insert failed: {book_insert.error.message}")

#     book_row = book_insert.data[0]
#     book_id = book_row["id"]

#     # create default chapter
#     supabase.table("chapters").insert({
#         "book_id": book_id,
#         "title": "Chapter 1",
#         "order_index": 1,
#         "start_page": 1
#     }).execute()

#     # insert book_content in batches
#     batch = []
#     batch_size = 100
#     for i, item in enumerate(parsed):
#         batch.append({
#             "book_id": book_id,
#             "content": item["content"],
#             "sequence_index": i + 1,
#             "page_number": item["page_number"]
#         })
#         if len(batch) >= batch_size:
#             res = supabase.table("book_content").insert(batch).execute()
#             if res.error:
#                 raise HTTPException(status_code=500, detail=f"Insert book_content failed: {res.error.message}")
#             batch = []
#     if batch:
#         res = supabase.table("book_content").insert(batch).execute()
#         if res.error:
#             raise HTTPException(status_code=500, detail=f"Insert book_content failed: {res.error.message}")

#     return {"status": "success", "book": book_row}

# class ExplainRequest(BaseModel):
#     text: str
#     interests: list = ["general"]
#     book_type: str = "general"

# @app.post("/api/explain")
# def explain(req: ExplainRequest):
#     # call explainer
#     result = generate_explanation(req.text, req.interests, req.book_type)
#     return {"result": result}

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)


import os
import time
import re
import json
import ast
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

# --- IMPORTS ---
from langchain_community.document_loaders import PyPDFLoader

from langchain_text_splitters import RecursiveCharacterTextSplitter

# NEW: Use Groq instead of Google
from langchain_groq import ChatGroq 

# 1. Load Env
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI()

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

# 4. Setup AI (GROQ - Llama 3 8B)
# This model is Free, Fast, and Good at JSON.
llm = ChatGroq(
    model="llama-3.1-8b-instant", 
    api_key=groq_key,
    temperature=0.3
)

class IngestRequest(BaseModel):
    bookId: str
    fileUrl: str
    interest: str
    bookType: str

# ... imports (make sure json, ast, PyPDFLoader, etc. are imported) ...

async def process_book(book_id: str, file_url: str, interest: str, book_type: str):
    print(f"🚀 Starting Structure Scan for Book: {book_id}")
    
    # 1. Update Status in 'course_books' (IMMEDIATELY)
    supabase.table("course_books").update({"status": "processing"}).eq("id", book_id).execute()
    
    try:
        # 2. Load PDF & Extract Text (First 20 pages only)
        loader = PyPDFLoader(file_url)
        pages = loader.load()
        print(f"📄 Loaded {len(pages)} pages")

        toc_text = ""
        # Scan first 20 pages (usually enough for ToC)
        for p in pages[:20]:
            toc_text += p.page_content + "\n"

        # 3. ASK AI FOR THE MAP
        prompt = f"""
        You are a JSON parser. 
        Analyze this book text. Find the "Table of Contents" (or Contents/Index).
        Extract a list of Chapters and their STARTING PAGE NUMBER.
        
        RULES:
        1. Ignore the Preface, Foreword, or Introduction if they are roman numerals (i, ii, etc).
        2. Look for patterns like "Chapter 1 ..... 5" or "1. The Beginning ..... 5".
        3. Return JSON ONLY. No conversation.
        
        TEXT PREVIEW:
        {toc_text[:15000]}...

        OUTPUT FORMAT:
        {{
            "chapters": [
                {{ "title": "Chapter 1: Name", "start_page": 5 }},
                {{ "title": "Chapter 2: Name", "start_page": 12 }}
            ]
        }}
        """
        
        # Using Llama-3.1-8b-Instant (Fast & Cheap)
        ai_response = llm.invoke(prompt)
        raw_content = ai_response.content
        
        # 4. ROBUST JSON EXTRACTION (REGEX)
        # This finds the first '{' and the last '}' to isolate the JSON, ignoring extra text.
        try:
            json_match = re.search(r"\{.*\}", raw_content, re.DOTALL)
            if json_match:
                clean_json = json_match.group(0)
                data = json.loads(clean_json)
            else:
                raise ValueError("No JSON object found in response")
                
        except Exception as parse_error:
            print(f"⚠️ JSON Parse Failed. Raw AI Response: {raw_content[:200]}...")
            raise parse_error

        chapters_list = data.get("chapters", [])
        print(f"🗺️ Found {len(chapters_list)} chapters in structure.")

        # 5. Save Structure to DB (Skeleton)
        for i, chap in enumerate(chapters_list):
            supabase.table("chapters").insert({
                "book_id": book_id,
                "title": chap['title'],
                "order_index": i + 1,
                "start_page_num": chap.get('start_page', 0)
            }).execute()

        # 6. Mark as Completed in 'course_books'
        supabase.table("course_books").update({"status": "completed"}).eq("id", book_id).execute()
        print(f"✅ Structure Scan Complete for: {book_id}")

    except Exception as e:
        print(f"❌ Error scanning book: {str(e)}")
        # 7. Mark as Failed in 'course_books'
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

@app.post("/generate_chapter")
async def generate_chapter(req: GenerateChapterRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_chapter_content, req.chapterId)
    return {"status": "started", "message": "Generating chapter content..."}

# 2. THE LOGIC
async def process_chapter_content(chapter_id: str):
    print(f"⚡ Generating content for Chapter ID: {chapter_id}")
    
    try:
        # A. Get Chapter Info & Book URL
        chapter = supabase.table("chapters").select("*").eq("id", chapter_id).single().execute()
        chap_data = chapter.data
        book_id = chap_data['book_id']
        start_page = chap_data['start_page_num']
        
        # Get Book URL
        book = supabase.table("course_books").select("file_url").eq("id", book_id).single().execute()
        file_url = book.data['file_url']

        # B. Find End Page (Look for the next chapter)
        # We find the chapter with the next highest order_index
        next_chap = supabase.table("chapters")\
            .select("start_page_num")\
            .eq("book_id", book_id)\
            .gt("order_index", chap_data['order_index'])\
            .order("order_index")\
            .limit(1)\
            .execute()

        if next_chap.data:
            end_page = next_chap.data[0]['start_page_num']
        else:
            end_page = start_page + 30 # Fallback: Read next 30 pages if it's the last chapter

        print(f"📖 Reading pages {start_page} to {end_page}...")

        # C. Load ONLY Specific Pages
        loader = PyPDFLoader(file_url)
        # Note: PyPDFLoader loads ALL, but we slice the array in memory (fast enough for <50MB books)
        # Optimization: For huge books, we would use pypdf directly to read specific byte ranges.
        all_pages = loader.load()
        
        # Safety check for bounds
        total_pages = len(all_pages)
        start_idx = max(0, start_page - 1) # PDF pages are 0-indexed
        end_idx = min(total_pages, end_page - 1)
        
        chapter_pages = all_pages[start_idx:end_idx]
        chapter_text = "\n".join([p.page_content for p in chapter_pages])

        # D. Smart Chunking (Group ~3 pages together)
        # 3 pages * ~500 words/page = 1500 words ~ 6000 chars
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=6000, 
            chunk_overlap=500
        )
        chunks = text_splitter.split_text(chapter_text)
        
        print(f"🧩 Split into {len(chunks)} learning sections.")

        # E. AI Processing Loop
        for i, chunk in enumerate(chunks):
            prompt = f"""
            You are an expert tutor. I will give you a section of a book chapter.
            Your job is to rewrite this into a clear, engaging learning module.
            
            RULES:
            1. Use Markdown formatting (headers, bold text).
            2. Explain complex ideas simply (using analogies if helpful).
            3. Keep it detailed but easy to read.
            
            TEXT TO PROCESS:
            {chunk}
            """
            
            response = llm.invoke(prompt)
            content = response.content

            # Save to 'paragraphs' table
            supabase.table("paragraphs").insert({
                "chapter_id": chapter_id,
                "content": content,
                "order_index": i + 1,
                "is_completed": False
            }).execute()
            
        print(f"✅ Finished generating Chapter: {chap_data['title']}")

    except Exception as e:
        print(f"❌ Error generating chapter: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)