from db import supabase

# Check the specific chapter from the screenshot URL
target_chapter_id = "6bfd2d38-c943-4c4f-94a0-b45334528f3d"

# Find book_id
res = supabase.table("chapters").select("book_id").eq("id", target_chapter_id).single().execute()

if res.data:
    book_id = res.data["book_id"]
    print(f"📖 Book ID: {book_id}")
    
    # List all chapters
    all_chaps = supabase.table("chapters").select("order_index, title, start_page_num").eq("book_id", book_id).order("order_index").execute()
    
    print("-" * 40)
    for c in all_chaps.data:
        print(f"Ch {c['order_index']}: {c['title'][:40].ljust(40)} (Start Page: {c['start_page_num']})")
    print("-" * 40)
else:
    print("Chapter not found!")
