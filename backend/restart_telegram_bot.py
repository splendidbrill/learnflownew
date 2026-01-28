"""
Simple script to restart the Telegram bot cleanly
"""
import subprocess
import sys
import time

print("=" * 60)
print("TELEGRAM BOT RESTART HELPER")
print("=" * 60)

# Kill any existing telegram bot processes
print("\n1. Stopping existing bot instances...")
try:
    # On Windows, use taskkill
    subprocess.run(
        ["taskkill", "/F", "/FI", "WINDOWTITLE eq python telegram_bot_polling.py*"],
        capture_output=True
    )
    print("   ✅ Existing instances stopped")
except:
    print("   ⚠️ Could not stop existing instances (may not be running)")

time.sleep(2)

# Start fresh bot instance
print("\n2. Starting fresh bot instance...")
print("\n" + "=" * 60)
print("Bot is starting... (Press Ctrl+C to stop)")
print("=" * 60 + "\n")

# Import and run the bot
from telegram_bot_polling import main
main()
