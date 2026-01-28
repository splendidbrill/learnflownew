from db import supabase
import sys

# Get all users and their Telegram status
profiles = supabase.table('profiles').select('id, telegram_chat_id').execute()

print("=" * 60)
print("TELEGRAM CONNECTION STATUS")
print("=" * 60)

for p in profiles.data or []:
    user_id_short = p['id'][:12] + "..."
    chat_id = p.get('telegram_chat_id') or "❌ NOT CONNECTED"
    print(f"User: {user_id_short} | Chat ID: {chat_id}")

print("=" * 60)

# Check active schedules
schedules = supabase.table('study_schedules').select('*').execute()
print(f"\nActive Study Schedules: {len(schedules.data or [])}")

if schedules.data:
    for s in schedules.data:
        print(f"  - Book: {s['book_id'][:12]}... | Chat ID: {s.get('telegram_chat_id', 'MISSING')}")

print("\nDiagnostics complete!")
