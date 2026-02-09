
import os
from db import supabase
from dotenv import load_dotenv

load_dotenv()

def fix_offset():
    # Book ID for the Physics book
    book_id = "27206254-0006-4d49-af55-19f9b75a6d1c"
    offset_correction = 10

    print(f"🔧 Fixing Offset for Book: {book_id}")
    
    # 1. Fetch all chapters
    res = supabase.table("chapters").select("*").eq("book_id", book_id).execute()
    chapters = res.data
    
    print(f"found {len(chapters)} chapters.")
    
    for ch in chapters:
        old_page = ch['start_page_num']
        new_page = old_page + offset_correction
        
        print(f"   Update Ch {ch['order_index']}: {ch['title'][:20]}... | {old_page} -> {new_page}")
        
        # 2. Update DB
        supabase.table("chapters").update({"start_page_num": new_page}).eq("id", ch['id']).execute()
        
    print("✅ Offset fixed!")

if __name__ == "__main__":
    fix_offset()
