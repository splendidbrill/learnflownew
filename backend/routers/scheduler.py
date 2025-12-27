import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from qstash import QStash
from datetime import datetime, timedelta
from db import supabase  # Import from your new shared db file
from dotenv import load_dotenv 

load_dotenv()  # <--- CALL THIS IMMEDIATELY

from db import supabase 
# Initialize Router
router = APIRouter()

# --- CONFIG ---
QSTASH_TOKEN = os.getenv("QSTASH_TOKEN")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
APP_URL = os.getenv("APP_URL") 

if not QSTASH_TOKEN or not TELEGRAM_BOT_TOKEN:
    print("⚠️ Warning: QStash or Telegram tokens missing in .env")

# Initialize QStash
try:
    qstash_client = QStash(token=QSTASH_TOKEN)
except:
    qstash_client = None

# --- MODELS ---
class CreateScheduleRequest(BaseModel):
    userId: str
    bookId: str
    chatId: str
    hour: int
    minute: int
    timezoneOffset: int = 0

class CronPayload(BaseModel):
    type: str
    userId: str
    bookId: str
    chatId: str

# --- HELPER FUNCTIONS ---
async def send_telegram_message(chat_id: str, text: str, buttons: list = None):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }
    if buttons:
        keyboard = [[{"text": btn, "callback_data": btn.upper()} for btn in buttons]]
        payload["reply_markup"] = {"inline_keyboard": keyboard}

    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload)

# --- ROUTES ---

@router.post("/schedule/create")
async def create_schedule(req: CreateScheduleRequest):
    if not qstash_client:
        raise HTTPException(status_code=500, detail="QStash not configured")

    # 1. Calculate Timings (Simplified for MVP - Assuming UTC input)
    # Schedule 30 mins before
    dt = datetime(2024, 1, 1, req.hour, req.minute) - timedelta(minutes=30)
    cron_30 = f"{dt.minute} {dt.hour} * * *"
    
    # Schedule 5 mins before
    dt_5 = datetime(2024, 1, 1, req.hour, req.minute) - timedelta(minutes=5)
    cron_5 = f"{dt_5.minute} {dt_5.hour} * * *"

    print(f"📅 Scheduling for User {req.userId}: {cron_30} and {cron_5}")

    try:
        # 2. Register with Upstash
        res_30 = qstash_client.schedule.create(
            cron=cron_30,
            destination=f"{APP_URL}/api/cron/trigger",
            body={"type": "30min", "userId": req.userId, "bookId": req.bookId, "chatId": req.chatId},
        )
        
        res_5 = qstash_client.schedule.create(
            cron=cron_5,
            destination=f"{APP_URL}/api/cron/trigger",
            body={"type": "5min", "userId": req.userId, "bookId": req.bookId, "chatId": req.chatId},
        )

        # 3. Save to Supabase
        supabase.table("study_schedules").insert({
            "user_id": req.userId,
            "book_id": req.bookId,
            "telegram_chat_id": req.chatId,
            "qstash_schedule_id_30": res_30.schedule_id,
            "qstash_schedule_id_5": res_5.schedule_id
        }).execute()

        return {"status": "scheduled", "ids": [res_30.schedule_id, res_5.schedule_id]}
    
    except Exception as e:
        print(f"Error scheduling: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ... imports and setup above remain the same ...

@router.post("/cron/trigger")
async def handle_notification(payload: CronPayload):
    print(f"🔔 Trigger received: {payload.type}")

    # 1. Log the Session in DB (Status: Pending)
    # We log it when the 5min warning fires, as that's the "real" session start trigger
    session_id = None
    
    if payload.type == "5min":
        try:
            session_data = supabase.table("study_sessions").insert({
                "user_id": payload.userId,
                "book_id": payload.bookId,
                "status": "pending",
                "notification_type": "5min"
            }).execute()
            
            # Save ID to pass it into the Telegram Button (callback_data)
            if session_data.data:
                session_id = session_data.data[0]['id']
                
        except Exception as e:
            print(f"⚠️ Failed to log session: {e}")

    # 2. Send Message
    if payload.type == "30min":
        # TODO: Fetch actual learning progress here for the summary
        teaser = "📚 **Study Session Ahead!**\n\nWe prepared a summary of your last session. Get ready!"
        # We don't track buttons for 30min summary, just a nudge
        await send_telegram_message(payload.chatId, teaser, buttons=None)

    elif payload.type == "5min":
        # We attach the SESSION ID to the button data so we know WHICH session to confirm
        # Format: "CONFIRM:<session_id>"
        confirm_data = f"CONFIRM:{session_id}" if session_id else "CONFIRM"
        skip_data = f"SKIP:{session_id}" if session_id else "SKIP"
        
        await send_telegram_message(
            payload.chatId, 
            "⚠️ **5 Minutes Left!**\nClass is starting. Are you joining?", 
            # We pass tuples: (Button Text, Callback Data)
            buttons=[
                ("I'm Ready", confirm_data),
                ("Skip Today", skip_data)
            ]
        )

    return {"status": "sent"}


@router.post("/hooks/telegram")
async def telegram_webhook(update: dict):
    """
    Handle button clicks from Telegram.
    Updates the 'study_sessions' table to track attendance.
    """
    if "callback_query" in update:
        query = update["callback_query"]
        raw_data = query["data"] # e.g. "CONFIRM:123-abc-456"
        chat_id = query["message"]["chat"]["id"]
        
        # Parse Action and Session ID
        if ":" in raw_data:
            action, session_id = raw_data.split(":", 1)
        else:
            action, session_id = raw_data, None

        message_text = ""

        if action == "CONFIRM":
            message_text = f"🔥 **Session Confirmed!**\nLet's go: {APP_URL}/dashboard"
            if session_id:
                supabase.table("study_sessions").update({"status": "confirmed"}).eq("id", session_id).execute()
                
        elif action == "SKIP":
            message_text = "No problem. Rest well! 💤"
            if session_id:
                supabase.table("study_sessions").update({"status": "skipped"}).eq("id", session_id).execute()

        # Send response
        await send_telegram_message(chat_id, message_text)

    return {"status": "ok"}

# --- Update the helper function to support custom callback data ---
async def send_telegram_message(chat_id: str, text: str, buttons: list = None):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }
    if buttons:
        # buttons is now a list of tuples: [("Text", "Data")]
        # If it's just a string list, handle that too for backward compatibility
        keyboard = []
        row = []
        for btn in buttons:
            if isinstance(btn, tuple):
                label, data = btn
            else:
                label, data = btn, btn.upper()
            
            row.append({"text": label, "callback_data": data})
        
        keyboard.append(row)
        payload["reply_markup"] = {"inline_keyboard": keyboard}

    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload)