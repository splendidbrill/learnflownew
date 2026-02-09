
import os
import fitz
import httpx
import asyncio
from db import supabase
from dotenv import load_dotenv

load_dotenv()

async def debug_offset():
    # Target Chapter: Ch 8 "MOTION"
    # User says it shows Ch 7 content.
    target_chapter_id = "6bfd2d38-c943-4c4f-94a0-b45334528f3d"

    # 1. Get Chapter Info
    res = supabase.table("chapters").select("*").eq("id", target_chapter_id).single().execute()
    if not res.data:
        print("Chapter not found")
        return

    chapter = res.data
    book_id = chapter['book_id']
    start_page = chapter['start_page_num']
    title = chapter['title']

    print(f"📘 Chapter: {title}")
    print(f"📖 Book ID: {book_id}")
    print(f"📄 DB Start Page: {start_page} (Expected PDF index: {start_page - 1})")

    # 2. Get Book Info & PDF
    book_res = supabase.table("course_books").select("file_url").eq("id", book_id).single().execute()
    file_url = book_res.data['file_url']

    print("⬇️ Downloading PDF...")
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(file_url)
        pdf_bytes = resp.content
    
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    print(f"📑 Total Pages: {len(doc)}")

    # 3. Check Expected Page (start_page - 1)
    idx = start_page - 1
    print(f"\n--- Checking Content at doc[{idx}] (Page {start_page}) ---")
    if idx < len(doc):
        page = doc[idx]
        text = page.get_text()
        print(f"PREVIEW:\n{text[:500]}")
        
        if "MOTION" in text or "Chapter 8" in text:
            print("✅ FOUND TITLE ON EXPECTED PAGE")
        else:
            print("❌ TITLE NOT FOUND ON EXPECTED PAGE")

            # 4. Dump specific range where we expect Ch 8 (around 108)
            print("\n🔎 Dumping Pages 105-115...")
            for i in range(105, 115):
                if i >= len(doc): break
                print(f"--- doc[{i}] ---")
                print(doc[i].get_text()[:300])
                print("-" * 20)
    else:
        print("❌ Index out of bounds")

if __name__ == "__main__":
    asyncio.run(debug_offset())
