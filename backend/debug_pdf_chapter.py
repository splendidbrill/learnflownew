import fitz
import sys
import os
import asyncio
from db import supabase

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

# --- CONFIG ---
CHAPTER_ID = "6bda2e6d-6a5d-4cea-b219-8a411fe08bc1"  # From screenshot
# CHAPTER_ID = "f2133de6-a461-411a-81ad-b5bce4acc4b0"  # Old ID

async def debug_chapter(chapter_id):
    print(f"🔍 Analyzing Chapter: {chapter_id}")
    
    # 1. Fetch metadata
    try:
        chapter = None
        if chapter_id == "latest":
            print("Running on LATEST chapter...")
            recent = supabase.table("chapters").select("*").order("created_at", desc=True).limit(1).execute()
            if recent.data: chapter = recent.data[0]
        else:
            chapter_res = supabase.table("chapters").select("*").eq("id", chapter_id).execute()
            if chapter_res.data: chapter = chapter_res.data[0]
        
        if not chapter:
            print(f"❌ Chapter {chapter_id} not found.")
            print("Listing 5 most recent chapters:")
            recent = supabase.table("chapters").select("id, title, book_id, created_at").order("created_at", desc=True).limit(5).execute()
            for c in recent.data:
                print(f" - {c['title']} (ID: {c['id']})")
            return
            
        print(f"✅ Selected Chapter: {chapter['title']} (ID: {chapter['id']})")
            
        print(f"Title: {chapter['title']}")
        print(f"Order: {chapter['order_index']}")
        start_page = chapter['start_page_num']
        print(f"Start Page (1-index): {start_page}")
        
        book_id = chapter['book_id']
        book = supabase.table("course_books").select("file_url").eq("id", book_id).single().execute()
        file_url = book.data['file_url']
        print(f"PDF URL: {file_url[:50]}...")
        
    except Exception as e:
        print(f"❌ DB Fetch Error: {e}")
        return

    # 2. Download PDF
    import httpx
    print("⬇️ Downloading PDF...")
    async with httpx.AsyncClient() as client:
        resp = await client.get(file_url)
        pdf_bytes = resp.content
    
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    print(f"✅ PDF Opened. Pages: {len(doc)}")
    
    # 3. Analyze First 3 Pages of Chapter
    # (Assuming next chapter starts somewhere later, let's look at start_page)
    
    start_idx = max(0, start_page - 1)
    # Check bounds
    if start_idx >= len(doc):
        # Scan ALL pages for text to find logical page 1?
        # Simulating main.py logic:
        print(f"⚠️ Start Page {start_idx} out of bounds (Doc len: {len(doc)}). Using Page 0.")
        start_idx = 0
            
    pages_to_scan = 3
    
    print("\n" + "="*50)
    for i in range(pages_to_scan):
        page_num = start_idx + i
        if page_num >= len(doc): break
        
        page = doc[page_num]
        rect = page.rect
        print(f"\n📃 PAGE {page_num+1} (Size: {rect.width:.1f}x{rect.height:.1f})")
        
        # Get raw structure
        blocks = page.get_text("dict")["blocks"]
        print(f"   Found {len(blocks)} blocks")
        
        # --- SIMULATE REVERTED MAIN.PY LOGIC ---
        
        image_count = 0
        skipped_count = 0
        
        for j, b in enumerate(blocks):
            if b["type"] == 1: # Image
                bbox = fitz.Rect(b["bbox"])
                area = bbox.width * bbox.height
                page_area = rect.width * rect.height
                ratio = area / page_area
                aspect = bbox.width / bbox.height if bbox.height > 0 else 1
                
                print(f"   [IMAGE] Block {j}: Area: {ratio:.1%} ({bbox.width:.1f}x{bbox.height:.1f}) Aspect: {aspect:.2f}")
                
                # Logic from reverted main.py
                if bbox.width < 150 or bbox.height < 150:
                    print("      👉 Too small (Ignored)")
                    continue

                # THE KEY FIX: Skip full-page images (>90%)
                if ratio > 0.9:
                    print("      ✅ SKIPPED: Full-page image (>90%)")
                    skipped_count += 1
                    continue
                
                # NEW: Skip large square images (watermarks)
                if ratio > 0.35 and 0.9 < aspect < 1.1:
                    print("      ✅ SKIPPED: Watermark (large + square)")
                    skipped_count += 1
                    continue
                
                print("      👉 KEPT: Diagram (will be uploaded)")
                image_count += 1
        
        print(f"\n   RESULT: {image_count} diagrams kept, {skipped_count} images skipped")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        CHAPTER_ID = sys.argv[1]
    asyncio.run(debug_chapter(CHAPTER_ID))
