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
# --- AWS CONFIG ---
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_LAMBDA_ARN = os.getenv("AWS_LAMBDA_ARN")     # The Worker (Lambda)
AWS_ROLE_ARN = os.getenv("AWS_SCHEDULER_ROLE_ARN") # The Permission (IAM Role for Scheduler)

if not AWS_LAMBDA_ARN or not AWS_ROLE_ARN:
    print("⚠️ Warning: AWS Lambda/Role ARNs missing in .env")

# Initialize AWS Scheduler Client
try:
    import boto3
    scheduler_client = boto3.client('scheduler', region_name=AWS_REGION)
except:
    scheduler_client = None
    print("⚠️ Boto3 not installed or AWS credentials missing")

# --- MODELS ---
class CreateScheduleRequest(BaseModel):
    userId: str
    bookId: str
    chatId: str
    hour: int
    minute: int
    timezone: str        # e.g. "Asia/Kolkata"
    channels: list[str]  # ["telegram", "email"]

class CronPayload(BaseModel):
    type: str            # '30min' or '5min'
    userId: str
    bookId: str
    chatId: str
    channels: list[str]

@router.post("/schedule/create")
async def create_schedule(req: CreateScheduleRequest):
    if not scheduler_client:
        raise HTTPException(status_code=500, detail="AWS Scheduler not configured")

    target_chat_id = req.chatId
    if req.chatId == "TEMP_CHAT_ID" or not req.chatId:
        profile = supabase.table("profiles").select("telegram_chat_id").eq("id", req.userId).single().execute()
        if profile.data and profile.data.get("telegram_chat_id"):
            target_chat_id = profile.data["telegram_chat_id"]
        else:
            print("❌ No Telegram ID found in profile.")
            # raise HTTPException(status_code=400, detail="Telegram not connected")

    # 1. Convert User's Local Time to UTC
    try:
        local_tz = pytz.timezone(req.timezone)
        now = datetime.now()
        local_dt = local_tz.localize(datetime(now.year, now.month, now.day, req.hour, req.minute))
        utc_dt = local_dt.astimezone(pytz.utc)
        print(f"🕒 User Time: {req.hour}:{req.minute} {req.timezone} -> UTC: {utc_dt.hour}:{utc_dt.minute}")
    except Exception as e:
        print(f"Timezone error: {e}")
        utc_dt = datetime(now.year, now.month, now.day, req.hour, req.minute)

    # 2. Calculate Trigger (1 Minute Before)
    # For a daily schedule, we need the time 1 minute before the target time
    # e.g. Target 09:00 -> Trigger 08:59
    
    # We use the UTC time for the cron expression
    # Subtract 1 minute from the UTC target time of *today* to get the right MM HH
    trigger_dt = utc_dt - timedelta(minutes=1)
    
    # Format for EventBridge Cron: cron(mm hh * * ? *)
    # This runs every day at the specified UTC time
    cron_expr = f"cron({trigger_dt.minute} {trigger_dt.hour} * * ? *)"
    
    print(f"📅 Scheduling Daily for User {req.userId}: {req.hour}:{req.minute} {req.timezone} (UTC Trigger: {trigger_dt.hour}:{trigger_dt.minute})")

    try:
        # A. Log Session (Create pending session now)
        # For recurring, we might not want to create a session immediately for *every* future day right now.
        # But for the immediate next one, we can. 
        # However, for simplicity in this MVP, we will rely on the Lambda to just send the alert.
        # The Lambda currently puts "CONFIRM" or "SKIP" in buttons.
        
        lambda_payload = {
            "chat_id": target_chat_id,
            "message": f"⚠️ **Daily Study Reminder!**\n\nTime to learn! Are you ready?",
            # Using more specific callback data
            "buttons": [["I'm Ready", "CONFIRM_SESSION"], ["Skip Today", "SKIP_SESSION"], ["Turn Off", "STOP_ALERTS"]]
        }

        # B. Create/Update Schedule in AWS
        # We use a stable name (userId_bookId) so we can overwrite/update it easily to avoid duplicates
        schedule_name = f"study_alert_{req.userId}_{req.bookId}"
        
        response = scheduler_client.create_schedule(
            Name=schedule_name,
            ScheduleExpression=cron_expr,
            Target={
                'Arn': AWS_LAMBDA_ARN,
                'RoleArn': AWS_ROLE_ARN,
                'Input': json.dumps(lambda_payload)
            },
            FlexibleTimeWindow={'Mode': 'OFF'},
            # ActionAfterCompletion='DELETE' # REMOVED: We want it to recur!
        )
        
        print(f"✅ AWS Schedule Created/Updated: {response.get('ScheduleArn')}")

        # C. Save to Supabase (Record the ARN)
        # Check if exists first to update or insert
        current_schedule = supabase.table("study_schedules").select("*").eq("user_id", req.userId).eq("book_id", req.bookId).execute()
        
        if current_schedule.data:
             supabase.table("study_schedules").update({
                "telegram_chat_id": target_chat_id,
                "cron_schedule": f"{req.hour}:{req.minute} {req.timezone}",
                "qstash_schedule_id_3": response.get('ScheduleArn')
            }).eq("id", current_schedule.data[0]['id']).execute()
        else:
            supabase.table("study_schedules").insert({
                "user_id": req.userId,
                "book_id": req.bookId,
                "telegram_chat_id": target_chat_id,
                "cron_schedule": f"{req.hour}:{req.minute} {req.timezone}",
                "qstash_schedule_id_3": response.get('ScheduleArn') 
            }).execute()

        return {"status": "scheduled", "ids": [response.get('ScheduleArn')]}
    
    except Exception as e:
        print(f"Error scheduling AWS: {e}")
        return {"status": "error", "detail": str(e)}


@router.delete("/schedule/delete/{user_id}/{book_id}")
async def delete_schedule(user_id: str, book_id: str):
    """Delete the AWS Schedule (Opt-out)"""
    if not scheduler_client:
         raise HTTPException(status_code=500, detail="AWS Scheduler not configured")
         
    schedule_name = f"study_alert_{user_id}_{book_id}"
    
    try:
        # Delete from AWS
        scheduler_client.delete_schedule(Name=schedule_name)
        print(f"✅ AWS Schedule Deleted: {schedule_name}")
    except Exception as e:
        if "ResourceNotFoundException" in str(e):
             print(f"⚠️ Schedule not found in AWS (already deleted?): {schedule_name}")
        else:
            print(f"❌ Error deleting AWS schedule: {e}")
            # We continue to delete from DB even if AWS fails
            
    try:
        # Delete from DB
        supabase.table("study_schedules").delete().eq("user_id", user_id).eq("book_id", book_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        print(f"❌ Error deleting DB schedule: {e}")
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

@router.get("/user/telegram-qr/{user_id}")
async def get_telegram_qr(user_id: str):
    """Generate QR code for easy Telegram bot connection"""
    try:
        import qrcode
        from io import BytesIO
        from fastapi.responses import StreamingResponse
        
        # Get bot username from token (we'll use the token to fetch it)
        TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
        if not TELEGRAM_BOT_TOKEN:
            raise HTTPException(status_code=500, detail="Bot token not configured")
        
        # Fetch bot info to get username
        async with httpx.AsyncClient() as client:
            bot_info_resp = await client.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe")
            if bot_info_resp.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch bot info")
            bot_data = bot_info_resp.json()
            bot_username = bot_data.get("result", {}).get("username", "")
        
        if not bot_username:
            raise HTTPException(status_code=500, detail="Bot username not found")
        
        # Create Telegram deep link
        telegram_link = f"https://t.me/{bot_username}?start={user_id}"
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(telegram_link)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to bytes
        buf = BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        
        return StreamingResponse(buf, media_type="image/png")
        
    except ImportError:
        raise HTTPException(status_code=500, detail="QR code library not installed")
    except Exception as e:
        print(f"❌ QR generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/telegram-status/{user_id}")
async def get_telegram_status(user_id: str):
    """Check if user has connected their Telegram account"""
    try:
        res = supabase.table("profiles").select("telegram_chat_id").eq("id", user_id).single().execute()
        
        if res.data and res.data.get("telegram_chat_id"):
            return {"connected": True}
        else:
            return {"connected": False}
    except Exception as e:
        print(f"❌ Error checking Telegram status: {e}")
        return {"connected": False}

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