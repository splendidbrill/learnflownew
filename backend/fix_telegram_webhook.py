import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
APP_URL = os.getenv("APP_URL")

async def check_and_set_webhook():
    print("=" * 60)
    print("TELEGRAM WEBHOOK DIAGNOSTIC")
    print("=" * 60)
    
    # 1. Check current webhook
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo")
        info = resp.json()
        
        print(f"\nCurrent Webhook URL: {info['result'].get('url', 'NOT SET')}")
        print(f"Last Error: {info['result'].get('last_error_message', 'None')}")
        print(f"Pending Updates: {info['result'].get('pending_update_count', 0)}")
        
        # 2. Set webhook to current APP_URL
        webhook_url = f"{APP_URL}/api/hooks/telegram"
        print(f"\n📡 Setting webhook to: {webhook_url}")
        
        set_resp = await client.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook",
            params={"url": webhook_url}
        )
        result = set_resp.json()
        
        if result.get("ok"):
            print("✅ Webhook set successfully!")
        else:
            print(f"❌ Failed: {result.get('description')}")
        
        # 3. Test if webhook URL is accessible
        print(f"\n🌐 Testing if {webhook_url} is accessible...")
        try:
            test_resp = await client.get(webhook_url, timeout=5.0)
            print(f"   Status: {test_resp.status_code}")
        except Exception as e:
            print(f"   ❌ Cannot reach webhook: {e}")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(check_and_set_webhook())
