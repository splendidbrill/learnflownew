from db import supabase
import json

print("=" * 60)
print("DETAILED TELEGRAM & SCHEDULE DIAGNOSTIC")
print("=" * 60)

# 1. Check all profiles
print("\n📋 USER PROFILES:")
profiles = supabase.table('profiles').select('id, telegram_chat_id, email').execute()
for p in (profiles.data or []):
    user_id_short = p['id'][:20] + "..."
    chat_id = p.get('telegram_chat_id') or "❌ NOT SET"
    email = (p.get('email') or "N/A")[:30]
    print(f"  User: {user_id_short}")
    print(f"    Email: {email}")
    print(f"    Chat ID: {chat_id}")
    print()

# 2. Check recent schedules
print("\n📅 STUDY SCHEDULES:")
schedules = supabase.table('study_schedules').select('*').order('created_at', desc=True).limit(5).execute()

if schedules.data:
    for s in schedules.data:
        print(f"  Book: {s['book_id'][:12]}...")
        print(f"    Chat ID Saved: {s.get('telegram_chat_id', 'MISSING')}")
        print(f"    Cron Schedule: {s.get('cron_schedule', 'N/A')}")
        print(f"    Created: {s.get('created_at', 'N/A')[:19]}")
        print()
else:
    print("  ⚠️ No schedules found!")

print("=" * 60)
