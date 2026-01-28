"""
Delete ALL QStash schedules to clear the quota
"""
import os
from qstash import QStash
from dotenv import load_dotenv
from db import supabase

load_dotenv()

QSTASH_TOKEN = os.getenv("QSTASH_TOKEN")
qstash = QStash(token=QSTASH_TOKEN)

print("=" * 60)
print("CLEARING ALL QSTASH SCHEDULES")
print("=" * 60)

try:
    # List all schedules
    schedules = qstash.schedule.list()
    
    total = len(schedules)
    print(f"\n📋 Found {total} QStash schedules")
    
    if total == 0:
        print("✅ No schedules to delete")
    else:
        print(f"\n🗑️  Deleting all {total} schedules...\n")
        
        deleted = 0
        for schedule in schedules:
            schedule_id = schedule.schedule_id
            try:
                qstash.schedule.delete(schedule_id)
                deleted += 1
                print(f"  ✅ Deleted: {schedule_id}")
            except Exception as e:
                print(f"  ❌ Failed to delete {schedule_id}: {e}")
        
        print(f"\n✅ Deleted {deleted}/{total} schedules")
    
    # Also clear database entries
    print("\n🗑️  Clearing database study_schedules table...")
    result = supabase.table('study_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("✅ Database cleared")
    
    print("\n" + "=" * 60)
    print("DONE! You can now create new schedules.")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nTry logging into QStash dashboard to delete manually:")
    print("https://console.upstash.com/qstash")

