"""
Test if Telegram notifications work
"""
import os
import asyncio
import httpx
from dotenv import load_dotenv
from db import supabase

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

async def send_test_notification():
    print("=" * 60)
    print("TESTING TELEGRAM NOTIFICATION")
    print("=" * 60)
    
    # Get the first user's chat_id
    profiles = supabase.table('profiles').select('telegram_chat_id').execute()
    
    chat_ids = [p.get('telegram_chat_id') for p in (profiles.data or []) if p.get('telegram_chat_id') and p.get('telegram_chat_id') != 'TEMP_CHAT_ID']
    
    if not chat_ids:
        print("❌ No connected Telegram users found!")
        print("\nℹ️  Make sure you've connected Telegram with /start {user_id}")
        return
    
    chat_id = chat_ids[0]
    print(f"\n📱 Found Chat ID: {chat_id}")
    print(f"🔔 Sending test notification...\n")
    
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": "🔔 **Test Notification from LearnFlow!**\n\nIf you can see this, notifications are working! ✅\n\nYour study session reminders will arrive like this.",
        "parse_mode": "Markdown"
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload)
        
        if resp.status_code == 200:
            print("✅ Notification sent successfully!")
            print("\n📱 Check your Telegram app now!")
        else:
            print(f"❌ Failed: {resp.status_code}")
            print(f"   Error: {resp.text}")
    
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(send_test_notification())
