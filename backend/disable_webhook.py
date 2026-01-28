"""
Disable Telegram Webhook (Use Polling Instead)
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

print("=" * 60)
print("DISABLING TELEGRAM WEBHOOK")
print("=" * 60)

# Delete the webhook
response = requests.post(
    f"https://api.telegram.org/bot{BOT_TOKEN}/deleteWebhook"
)

result = response.json()

if result.get("ok"):
    print("✅ Webhook disabled successfully!")
    print("\nℹ️  Now using polling mode only.")
    print("   Make sure 'python telegram_bot_polling.py' is running.")
else:
    print(f"❌ Failed: {result.get('description')}")

print("=" * 60)
