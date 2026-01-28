"""
Fix existing schedules by updating chat_id from TEMP_CHAT_ID to real chat_id
"""
from db import supabase

print("=" * 60)
print("FIXING STUDY SCHEDULES")
print("=" * 60)

# Get real chat_id
profiles = supabase.table('profiles').select('id, telegram_chat_id').execute()
real_chat_id = None

for p in (profiles.data or []):
    chat_id = p.get('telegram_chat_id')
    if chat_id and chat_id != 'TEMP_CHAT_ID':
        real_chat_id = chat_id
        user_id = p['id']
        print(f"\n✅ Found real chat ID: {real_chat_id}")
        print(f"   For user: {user_id[:20]}...")
        break

if not real_chat_id:
    print("\n❌ No real chat_id found. Connect Telegram first!")
    exit(1)

# Update all schedules with TEMP_CHAT_ID
result = supabase.table('study_schedules').update({
    'telegram_chat_id': real_chat_id
}).eq('telegram_chat_id', 'TEMP_CHAT_ID').execute()

updated_count = len(result.data) if result.data else 0

print(f"\n✅ Updated {updated_count} schedule(s) with correct chat_id")
print("\n" + "=" * 60)
print("NEXT STEPS:")
print("=" * 60)
print("1. Create a NEW schedule for a FUTURE time")
print("2. Set it for at least 35 minutes from now to test both alerts")
print("3. You'll get notifications at -30min and -5min before")
print("=" * 60)
