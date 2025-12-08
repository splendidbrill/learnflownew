import os
from dotenv import load_dotenv

# Add 'Form' to this line
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from supabase import create_client, Client
from pydantic import BaseModel
from services.explainer import generate_explanation
from fastapi import File, UploadFile
from services.book_parser import parse_pdf_to_blocks

# 1. Load the secrets from .env
load_dotenv()

# 2. Initialize the App
app = FastAPI(title="LearnFlow API")

# 3. Connect to Database
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("❌ ERROR: Missing Supabase URL or Key in .env file")
else:
    print("✅ Supabase Credentials Loaded")

# Initialize Supabase Client
try:
    supabase: Client = create_client(url, key)
    print("✅ Connected to Supabase")
except Exception as e:
    print(f"❌ Failed to connect to Supabase: {e}")

# 4. The Health Check (To test if it works)
@app.get("/")
def read_root():
    return {"status": "active", "message": "LearnFlow Backend is Online 🚀"}

# 5. Test Database Connection Endpoint
@app.get("/test-db")
def test_db():
    try:
        # Fetch the first row from 'profiles' just to see if we can read data
        response = supabase.table("profiles").select("*").limit(1).execute()
        return {"db_status": "connected", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- NEW: AI Endpoint ---

class ExplainRequest(BaseModel):
    text: str
    interests: list = ["general"]
    book_type: str = "general"

@app.post("/api/explain")
def explain_text(request: ExplainRequest):
    print(f"🧠 Generating explanation for: {request.book_type}")
    
    result = generate_explanation(
        content=request.text,
        interests=request.interests,
        book_type=request.book_type
    )
    
    return result

# --- NEW: Upload Endpoint ---

@app.post("/api/upload-book")
async def upload_book(
   title: str = Form(...),
    user_id: str = Form(...), 
    file: UploadFile = File(...)
):
    print(f"📚 Uploading book: {title} for user {user_id}")
    
    # 1. Read the file
    content = await file.read()
    
    # 2. Parse PDF
    blocks = parse_pdf_to_blocks(content)
    print(f"✅ Extracted {len(blocks)} paragraphs.")

    # 3. Create Book Entry in Supabase
    book_res = supabase.table("books").insert({
        "user_id": user_id,
        "title": title,
        "total_blocks": len(blocks),
        "processed": True
    }).execute()
    
    book_id = book_res.data[0]['id']

    # 4. Save Blocks to Supabase
    # We batch them to be faster (insert 50 at a time)
    batch_size = 50
    for i in range(0, len(blocks), batch_size):
        batch = blocks[i:i + batch_size]
        # Add book_id to every block
        for block in batch:
            block['book_id'] = book_id
            # Remove page_number if your DB doesn't have that column, or add it to content
            del block['page_number'] 
        
        supabase.table("content_blocks").insert(batch).execute()
        print(f"💾 Saved batch {i} to {i + len(batch)}")

    return {"status": "success", "book_id": book_id, "blocks_count": len(blocks)}

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)