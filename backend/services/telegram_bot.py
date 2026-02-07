"""
Telegram Bot Service for Review Notifications

Handles /start command and sends review reminders.
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BOT_USERNAME = "learnainew_bot"


async def send_telegram_message(chat_id: str, message: str, buttons=None):
    """
    Send a message to a Telegram chat.
    
    Args:
        chat_id: Telegram chat ID
        message: Message text (supports Markdown)
        buttons: Optional list of (text, callback_data) tuples
    """
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown"
    }
    
    # Add inline keyboard if buttons provided
    if buttons:
        keyboard = {
            "inline_keyboard": [
                [{"text": text, "callback_data": data}] 
                for text, data in buttons
            ]
        }
        payload["reply_markup"] = keyboard
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        return response.json()


async def handle_telegram_start(chat_id: str, user_id: str):
    """
    Handle /start command from Telegram.
    Links the Telegram chat to the LearnFlow user.
    
    Args:
        chat_id: Telegram chat ID
        user_id: LearnFlow user ID (from deep link parameter)
    """
    from db import supabase
    
    try:
        # Store chat_id in user profile
        supabase.table("profiles").update({
            "telegram_chat_id": chat_id
        }).eq("id", user_id).execute()
        
        # Send confirmation message
        await send_telegram_message(
            chat_id,
            "✅ **Connected to LearnFlow!**\n\n"
            "You'll now receive review reminders here.\n\n"
            "📚 Keep learning, and I'll help you remember!"
        )
        
        print(f"✅ Telegram connected: user {user_id} → chat {chat_id}")
        return True
    except Exception as e:
        print(f"❌ Telegram connection error: {e}")
        await send_telegram_message(
            chat_id,
            "❌ Connection failed. Please try again from the LearnFlow app."
        )
        return False


async def send_review_reminder(chat_id: str, concept: str, review_url: str):
    """
    Send a review reminder notification.
    
    Args:
        chat_id: Telegram chat ID
        concept: Concept name to review
        review_url: Direct link to review page
    """
    message = (
        f"📚 **Time to Review!**\n\n"
        f"Concept: *{concept}*\n\n"
        f"Click below to review now 👇"
    )
    
    buttons = [
        ("Review Now", review_url),
        ("Remind Me Tomorrow", "SNOOZE")
    ]
    
    await send_telegram_message(chat_id, message, buttons)


# Webhook handler for Telegram updates
async def handle_telegram_webhook(update: dict):
    """
    Process incoming Telegram webhook updates.
    Handles /start commands and button callbacks.
    """
    # Handle /start command
    if "message" in update:
        message = update["message"]
        chat_id = str(message["chat"]["id"])
        text = message.get("text", "")
        
        if text.startswith("/start"):
            # Extract user_id from deep link parameter
            parts = text.split()
            if len(parts) > 1:
                user_id = parts[1]
                await handle_telegram_start(chat_id, user_id)
            else:
                await send_telegram_message(
                    chat_id,
                    "👋 Welcome! Please connect from the LearnFlow app first."
                )
    
    # Handle button callbacks
    elif "callback_query" in update:
        callback = update["callback_query"]
        chat_id = str(callback["message"]["chat"]["id"])
        data = callback["data"]
        
        if data == "SNOOZE":
            await send_telegram_message(
                chat_id,
                "⏰ Okay! I'll remind you tomorrow."
            )
        # Add more callback handlers as needed
    
    return {"status": "ok"}
