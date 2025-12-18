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

async def process_book(book_id: str, file_url: str, interest: str, book_type: str):
    print(f"🚀 Starting Smart Ingestion (Groq) for Book: {book_id}")
    
    try:
        loader = PyPDFLoader(file_url)
        pages = loader.load()
        print(f"📄 Loaded {len(pages)} pages")

        # --- SMART SKIPPER ---
        start_index = 0
        for i, page in enumerate(pages[:20]):
            content_lower = page.page_content.lower()
            if "table of contents" in content_lower or ("contents" in content_lower[:50]):
                print(f"📑 Found Table of Contents at Page {i+1}. Skipping pre-amble.")
                start_index = i
                break
        
        pages = pages[start_index:]
        
        # Groq handles smaller chunks better/faster
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=400)
        chunks = text_splitter.split_documents(pages)
        print(f"🔪 Split into {len(chunks)} text chunks")

        current_chapter_id = None
        chapter_count = 1
        
        # Initial Chapter
        first_chap_res = supabase.table("chapters").insert({
            "book_id": book_id,
            "title": "Introduction / Table of Contents",
            "order_index": 1
        }).execute()
        current_chapter_id = first_chap_res.data[0]['id']

        for i, chunk in enumerate(chunks):
            
            prompt = f"""
            You are an AI Tutor. Analyze this text chunk from a {book_type} book.
            
            USER INTEREST: {interest}
            CONTEXT: {chunk.page_content[:2500]}...

            TASKS:
            1. Detect if this chunk STARTS a new chapter.
            2. Generate a concise explanation using analogies related to {interest}.

            OUTPUT FORMAT: Return ONLY valid JSON.
            {{
                "is_new_chapter": true/false,
                "chapter_title": "Title Here",
                "explanation": "Your explanation here"
            }}
            """

            try:
                ai_response = llm.invoke(prompt)
                
                # Clean Response
                clean_text = ai_response.content
                if "```json" in clean_text:
                    clean_text = clean_text.split("```json")[1].split("```")[0].strip()
                elif "```" in clean_text:
                    clean_text = clean_text.split("```")[1].strip()
                
                try:
                    data = json.loads(clean_text)
                except:
                    try:
                        data = ast.literal_eval(clean_text)
                    except:
                        data = {"explanation": "Analysis failed", "is_new_chapter": False}

                # Logic
                if data.get("is_new_chapter") and data.get("chapter_title"):
                    print(f"🔖 New Chapter: {data['chapter_title']}")
                    chapter_count += 1
                    chap_res = supabase.table("chapters").insert({
                        "book_id": book_id,
                        "title": data['chapter_title'],
                        "order_index": chapter_count
                    }).execute()
                    current_chapter_id = chap_res.data[0]['id']

                # Save
                supabase.table("paragraphs").insert({
                    "chapter_id": current_chapter_id,
                    "content": chunk.page_content,
                    "explanation": data.get("explanation", "No explanation."),
                    "order_index": i,
                    "is_completed": False
                }).execute()
                
                print(f"✅ Processed Chunk {i}/{len(chunks)}")
                # Groq is fast, but let's be polite
                time.sleep(2) 

            except Exception as e:
                print(f"⚠️ Error on chunk {i}: {e}")
                continue
            
        print(f"✅ Finished processing Book: {book_id}")
        
    except Exception as e:
        print(f"❌ Error processing book: {str(e)}")

@app.post("/ingest")
async def ingest_book(req: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_book, req.bookId, req.fileUrl, req.interest, req.bookType)
    return {"status": "processing_started"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)