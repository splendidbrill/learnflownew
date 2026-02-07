import os
import json
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from qstash import QStash
from datetime import datetime, timedelta
import pytz
from db import supabase  # Import from your new shared db file
from dotenv import load_dotenv 

load_dotenv()  # <--- CALL THIS IMMEDIATELY

from db import supabase 
from services.email_service import send_30min_reminder_email, send_5min_reminder_email
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
    timezone: str        # <--- NEW: e.g. "Asia/Kolkata"
    channels: list[str]  # <--- NEW: ["telegram", "email"]

class CronPayload(BaseModel):
    type: str            # '30min' or '5min'
    userId: str
    bookId: str
    chatId: str
    channels: list[str]  # <--- NEW

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
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            print(f"❌ Telegram Reply Failed: {resp.text}")
        else:
            print(f"✅ Telegram Reply Sent to {chat_id}")

# --- ROUTES ---

@router.get("/user/telegram-status/{user_id}")
async def check_telegram_status(user_id: str):
    # Check if profile has a chat_id
    res = supabase.table("profiles").select("telegram_chat_id").eq("id", user_id).single().execute()
    
    is_connected = False
    if res.data and res.data.get("telegram_chat_id"):
        is_connected = True
        
    return {"connected": is_connected}

# @router.post("/schedule/create")
# async def create_schedule(req: CreateScheduleRequest):
#     if not qstash_client:
#         raise HTTPException(status_code=500, detail="QStash not configured")
    
#     target_chat_id = req.chatId
    
#     # If frontend sent placeholder, lookup in DB
#     if req.chatId == "TEMP_CHAT_ID" or not req.chatId:
#         profile = supabase.table("profiles").select("telegram_chat_id").eq("id", req.userId).single().execute()
#         if profile.data and profile.data.get("telegram_chat_id"):
#             target_chat_id = profile.data["telegram_chat_id"]
#         else:
#             raise HTTPException(status_code=400, detail="Telegram not connected. Please connect first.")

#     # 1. Calculate Timings (Simplified for MVP - Assuming UTC input)
#     # Schedule 30 mins before
#     dt = datetime(2024, 1, 1, req.hour, req.minute) - timedelta(minutes=30)
#     cron_30 = f"{dt.minute} {dt.hour} * * *"
    
#     # Schedule 5 mins before
#     dt_5 = datetime(2024, 1, 1, req.hour, req.minute) - timedelta(minutes=5)
#     cron_5 = f"{dt_5.minute} {dt_5.hour} * * *"

#     print(f"📅 Scheduling for User {req.userId}: {cron_30} and {cron_5}")

#     try:
#         # 2. Register with Upstash
#         res_30 = qstash_client.schedule.create(
#             cron=cron_30,
#             destination=f"{APP_URL}/api/cron/trigger",
#             body={"type": "30min", "userId": req.userId, "bookId": req.bookId, "chatId": req.chatId},
#         )
        
#         res_5 = qstash_client.schedule.create(
#             cron=cron_5,
#             destination=f"{APP_URL}/api/cron/trigger",
#             body={"type": "5min", "userId": req.userId, "bookId": req.bookId, "chatId": req.chatId},
#         )

#         # 3. Save to Supabase
#         supabase.table("study_schedules").insert({
#             "user_id": req.userId,
#             "book_id": req.bookId,
#             "telegram_chat_id": req.chatId,
#             "qstash_schedule_id_30": res_30.schedule_id,
#             "qstash_schedule_id_5": res_5.schedule_id
#         }).execute()

#         return {"status": "scheduled", "ids": [res_30.schedule_id, res_5.schedule_id]}
    
#     except Exception as e:
#         print(f"Error scheduling: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
@router.post("/schedule/create")
async def create_schedule(req: CreateScheduleRequest):
    if not qstash_client:
        raise HTTPException(status_code=500, detail="QStash not configured")
    target_chat_id = req.chatId
    if req.chatId == "TEMP_CHAT_ID" or not req.chatId:
        profile = supabase.table("profiles").select("telegram_chat_id").eq("id", req.userId).single().execute()
        if profile.data and profile.data.get("telegram_chat_id"):
            target_chat_id = profile.data["telegram_chat_id"] # <--- WE HAVE THE REAL ID HERE
        else:
            print("❌ No Telegram ID found in profile.")
    # 1. Convert User's Local Time to UTC
    try:
        local_tz = pytz.timezone(req.timezone)
        
        # Create a "today" object at the user's preferred time
        now = datetime.now()
        local_dt = local_tz.localize(datetime(now.year, now.month, now.day, req.hour, req.minute))
        
        # Convert to UTC
        utc_dt = local_dt.astimezone(pytz.utc)
        
        print(f"🕒 User Time: {req.hour}:{req.minute} {req.timezone} -> UTC: {utc_dt.hour}:{utc_dt.minute}")
    except Exception as e:
        print(f"Timezone error: {e}")
        # Fallback to raw input if timezone fails
        utc_dt = datetime(now.year, now.month, now.day, req.hour, req.minute)

    # 2. Calculate Triggers (based on UTC time)
    # Schedule 3 mins before (single reminder)
    dt_3 = utc_dt - timedelta(minutes=3)
    cron_3 = f"{dt_3.minute} {dt_3.hour} * * *"

    print(f"📅 Scheduling for User {req.userId}: 3m({cron_3})")

    try:
        # 3. Register with Upstash
        # We pass the 'channels' list into the body so the trigger knows who to message
        
        # 3 Minute Trigger
        res_3 = qstash_client.schedule.create(
            cron=cron_3,
            destination=f"{os.getenv('APP_URL')}/api/cron/trigger",
            body=json.dumps({
                "type": "3min", 
                "userId": req.userId, 
                "bookId": req.bookId, 
                "chatId": target_chat_id, 
                "channels": req.channels
            }),
        )

        # 4. Save to Supabase
        supabase.table("study_schedules").insert({
            "user_id": req.userId,
            "book_id": req.bookId,
            "telegram_chat_id": target_chat_id,
            "cron_schedule": f"{req.hour}:{req.minute} {req.timezone}",
            "qstash_schedule_id_3": res_3
        }).execute()

        return {"status": "scheduled", "ids": [res_3]}
    
    except Exception as e:
        print(f"Error scheduling: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ... imports and setup above remain the same ...

@router.post("/cron/trigger")
async def handle_notification(payload: CronPayload):
    print(f"🔔 Trigger received: {payload.type}")

    # A. Log Session (Only on 5min mark)
    session_id = None
    if payload.type == "5min":
        try:
            session_data = supabase.table("study_sessions").insert({
                "user_id": payload.userId,
                "book_id": payload.bookId,
                "status": "pending",
                "notification_type": "5min"
            }).execute()
            
            if session_data.data:
                session_id = session_data.data[0]['id']
        except Exception as e:
            print(f"⚠️ Failed to log session: {e}")

    # B. Send to TELEGRAM (if selected)
    if "telegram" in payload.channels:
        if payload.type == "30min":
            teaser = (
                "📚 **Study Session Ahead!**\n\n"
                "We prepared a summary of your last session. Get ready!\n\n"
                "✨ *Consistency is key. Even 5 minutes a day makes you 44% better in a year.*"
            )
            # Add "I will study!" button
            await send_telegram_message(
                payload.chatId, 
                teaser, 
                buttons=[("I will study!", "COMMIT")]
            )

        elif payload.type == "5min":
            # Attach Session ID to buttons
            confirm_data = f"CONFIRM:{session_id}" if session_id else "CONFIRM"
            skip_data = f"SKIP:{session_id}" if session_id else "SKIP"
            
            await send_telegram_message(
                payload.chatId, 
                "⚠️ **5 Minutes Left!**\nClass is starting. Are you joining?", 
                buttons=[("I'm Ready", confirm_data), ("Skip Today", skip_data)]
            )

    # C. Send to EMAIL (if selected)
    if "email" in payload.channels:
        # Fetch user email from Supabase
        try:
            profile = supabase.table("profiles").select("email").eq("id", payload.userId).single().execute()
            user_email = profile.data.get("email") if profile.data else None
            
            if user_email:
                if payload.type == "30min":
                    await send_30min_reminder_email(user_email, payload.userId, session_id)
                elif payload.type == "5min":
                    await send_5min_reminder_email(user_email, payload.userId)
            else:
                print(f"⚠️ No email found for user {payload.userId}")
        except Exception as e:
            print(f"❌ Email send failed: {e}")

    return {"status": "sent"}




# routers/scheduler.py

@router.post("/hooks/telegram")
async def telegram_webhook(update: dict):
    print(f"📩 WEBHOOK RECEIVED: {update}") # 1. Prove we got it
    
    try:
        if "message" in update:
            msg = update["message"]
            chat_id = msg.get("chat", {}).get("id")
            text = msg.get("text", "")

            print(f"👤 Processing message from {chat_id}: {text}") # 2. Prove we parsed it

            if text.startswith("/start"):
                parts = text.split(" ")
                if len(parts) > 1:
                    user_uuid = parts[1]
                    print(f"🔗 Attempting to link UUID: {user_uuid}")
                    
                    try:
                        # Database Link
                        supabase.table("profiles").update({
                            "telegram_chat_id": str(chat_id)
                        }).eq("id", user_uuid).execute()
                        print("✅ Database updated successfully")
                        
                        await send_telegram_message(chat_id, "✅ **Connected!**\nReturn to the app.")
                    except Exception as db_e:
                        print(f"❌ DATABASE ERROR: {db_e}")
                        await send_telegram_message(chat_id, "❌ Database Error. Check server logs.")
                else:
                    print("👋 Regular start command received (no user ID)")
                    try:
                        await send_telegram_message(
                            chat_id, 
                            "👋 Welcome to LearnFlow!\n\n"
                            "To connect your account, use the 'Connect Telegram' button in the app.\n\n"
                            "Or send: `/start YOUR_USER_ID`"
                        )
                    except Exception as msg_e:
                        print(f"❌ Failed to send message: {msg_e}")

    except Exception as e:
        print(f"🔥 CRITICAL CRASH: {e}")
        import traceback
        traceback.print_exc()
        
    return {"status": "ok"}

# Updated Helper with Error Printing
async def send_telegram_message(chat_id: str, text: str, buttons: list = None):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
    
    if buttons:
        # Create inline keyboard with buttons
        keyboard = [[{"text": btn[0], "callback_data": btn[1]} for btn in buttons]]
        payload["reply_markup"] = {"inline_keyboard": keyboard}

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            print(f"❌ TELEGRAM API ERROR: {resp.status_code} - {resp.text}")
        else:
            print(f"✅ Message sent to {chat_id}")

# --- EMAIL ENDPOINTS ---

@router.get("/user/email/{user_id}")
async def get_user_email(user_id: str):
    """Fetch user email from Supabase Auth"""
    try:
        # Fetch from Supabase profiles table (assumes email is synced from auth)
        res = supabase.table("profiles").select("email").eq("id", user_id).single().execute()
        
        if res.data and res.data.get("email"):
            return {"email": res.data["email"]}
        else:
            return {"email": None}
    except Exception as e:
        print(f"❌ Error fetching email: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch email")

@router.get("/email/confirm")
async def email_confirm(session_id: str = None, user_id: str = None):
    """Handle 'I will study' button click from email"""
    print(f"✅ Email confirmation received: User {user_id}, Session {session_id}")
    
    # Optional: Update session status in database
    if session_id:
        try:
            supabase.table("study_sessions").update({
                "status": "confirmed"
            }).eq("id", session_id).execute()
        except Exception as e:
            print(f"⚠️ Failed to update session: {e}")
    
    # Return a simple HTML page
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Confirmed!</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .container {
                text-align: center;
                padding: 40px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                backdrop-filter: blur(10px);
            }
            .emoji { font-size: 64px; margin-bottom: 20px; }
            h1 { font-size: 48px; margin: 0; }
            p { font-size: 18px; opacity: 0.9; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="emoji">🎯</div>
            <h1>Great!</h1>
            <p>Your commitment is logged. See you in the session! 💪</p>
        </div>
    </body>
    </html>
    """
    
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_content)