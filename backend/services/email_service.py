"""
Email Notification Service
Sends study reminders via email with Resend as primary and Mailgun as fallback
"""
import os
import resend
from dotenv import load_dotenv

load_dotenv()

# Email Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@learnflow.com")
APP_URL = os.getenv("APP_URL")

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


async def send_30min_reminder_email(to_email: str, user_id: str, session_id: str = None):
    """
    Send 30-minute reminder email with 'I will study' button
    """
    confirmation_link = f"{APP_URL}/api/email/confirm?session_id={session_id}&user_id={user_id}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            .header {{ font-size: 24px; color: #1e0a3c; margin-bottom: 16px; }}
            .emoji {{ font-size: 32px; }}
            .button {{ 
                display: inline-block; 
                background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
                color: white; 
                padding: 14px 32px; 
                text-decoration: none; 
                border-radius: 10px; 
                font-weight: bold;
                margin: 24px 0;
            }}
            .quote {{ font-style: italic; color: #666; margin-top: 20px; }}
            .footer {{ text-align: center; margin-top: 32px; color: #999; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div style="text-align: center;">
                <div class="emoji">📚</div>
                <h2 class="header">Study Session Ahead!</h2>
            </div>
            
            <p style="color: #333; font-size: 16px;">
                Your study session starts in <strong>30 minutes</strong>. We've prepared a summary of your last session. Get ready!
            </p>
            
            <div style="text-align: center;">
                <a href="{confirmation_link}" class="button">
                    I will study!
                </a>
            </div>
            
            <p class="quote">
                ✨ <em>Consistency is key. Even 5 minutes a day makes you 44% better in a year.</em>
            </p>
            
            <div class="footer">
                <p>LearnFlow - Build a Learning Habit</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    subject = "📚 Study Session in 30 Minutes!"
    
    # Try Resend first
    try:
        result = await send_with_resend(to_email, subject, html_content)
        if result:
            print(f"✅ Email sent via Resend to {to_email}")
            return True
    except Exception as e:
        print(f"⚠️ Resend failed: {e}, trying Mailgun...")
    
    # Fallback to Mailgun
    try:
        result = await send_with_mailgun(to_email, subject, html_content)
        if result:
            print(f"✅ Email sent via Mailgun to {to_email}")
            return True
    except Exception as e:
        print(f"❌ Mailgun also failed: {e}")
    
    return False


async def send_5min_reminder_email(to_email: str, user_id: str):
    """
    Send 5-minute reminder email
    """
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            .header {{ font-size: 24px; color: #e11d48; margin-bottom: 16px; }}
            .emoji {{ font-size: 32px; }}
            .urgent {{ background: #fee2e2; border-left: 4px solid #e11d48; padding: 16px; border-radius: 8px; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 32px; color: #999; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div style="text-align: center;">
                <div class="emoji">⚠️</div>
                <h2 class="header">5 Minutes Left!</h2>
            </div>
            
            <div class="urgent">
                <p style="margin: 0; color: #333; font-size: 16px; font-weight: 600;">
                    Your study session is about to start!
                </p>
            </div>
            
            <p style="color: #333; font-size: 16px;">
                Open your LearnFlow app now and get ready to learn. 🚀
            </p>
            
            <div style="text-align: center; margin-top: 24px;">
                <a href="{APP_URL}" style="color: #7c3aed; text-decoration: none; font-weight: bold;">
                    → Open LearnFlow
                </a>
            </div>
            
            <div class="footer">
                <p>LearnFlow - Build a Learning Habit</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    subject = "⚠️ Study Session Starting in 5 Minutes!"
    
    # Try Resend first
    try:
        result = await send_with_resend(to_email, subject, html_content)
        if result:
            print(f"✅ Email sent via Resend to {to_email}")
            return True
    except Exception as e:
        print(f"⚠️ Resend failed: {e}, trying Mailgun...")
    
    # Fallback to Mailgun
    try:
        result = await send_with_mailgun(to_email, subject, html_content)
        if result:
            print(f"✅ Email sent via Mailgun to {to_email}")
            return True
    except Exception as e:
        print(f"❌ Mailgun also failed: {e}")
    
    return False


async def send_with_resend(to_email: str, subject: str, html_content: str):
    """
    Send email using Resend
    """
    if not RESEND_API_KEY or RESEND_API_KEY == "re_placeholder_key":
        raise Exception("Resend API key not configured")
    
    try:
        params = {
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        
        email = resend.Emails.send(params)
        return email
        
    except Exception as e:
        raise Exception(f"Resend error: {str(e)}")


async def send_with_mailgun(to_email: str, subject: str, html_content: str):
    """
    Send email using Mailgun as fallback
    """
    if not MAILGUN_API_KEY or MAILGUN_API_KEY == "placeholder_mailgun_key":
        raise Exception("Mailgun API key not configured")
    
    import httpx
    
    try:
        url = f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                auth=("api", MAILGUN_API_KEY),
                data={
                    "from": FROM_EMAIL,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Mailgun returned {response.status_code}: {response.text}")
                
    except Exception as e:
        raise Exception(f"Mailgun error: {str(e)}")


async def send_contact_email(data: dict):
    """
    Send contact form submission to admin
    """
    admin_email = "splendidbrill@gmail.com"
    subject = f"📩 New Contact: {data.get('firstName')} {data.get('lastName')}"
    
    # Format plan details if present
    plan_info = ""
    if data.get('isCustomer') == "yes":
        plan_info = f"""
        <div style="background: #eef2ff; padding: 12px; border-radius: 6px; margin: 12px 0;">
            <strong>💎 Status:</strong> Existing Customer<br>
            <strong>📊 Plan:</strong> {data.get('plan', 'Not specified')}
        </div>
        """
    else:
        plan_info = """
        <div style="background: #fdf2f8; padding: 12px; border-radius: 6px; margin: 12px 0;">
            <strong>👤 Status:</strong> New Visitor (Not a customer)
        </div>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border: 1px solid #eee; border-radius: 8px; padding: 24px; }}
            .header {{ border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 24px; }}
            .field {{ margin-bottom: 16px; }}
            .label {{ color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }}
            .value {{ font-size: 16px; color: #1e1e1e; font-weight: 500; margin-top: 4px; }}
            .message-box {{ background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #7c3aed; margin-top: 24px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>New Contact Message</h2>
            </div>
            
            <div class="field">
                <div class="label">From</div>
                <div class="value">{data.get('firstName')} {data.get('lastName')}</div>
            </div>
            
            <div class="field">
                <div class="label">Email</div>
                <div class="value"><a href="mailto:{data.get('email')}">{data.get('email')}</a></div>
            </div>

            {plan_info}
            
            <div class="message-box">
                <div class="label">Message</div>
                <div class="value" style="white-space: pre-wrap;">{data.get('message')}</div>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Try Resend first
    try:
        result = await send_with_resend(admin_email, subject, html_content)
        if result:
            print(f"✅ Contact email sent to {admin_email}")
            return True
    except Exception as e:
        print(f"⚠️ Resend failed: {e}, trying Mailgun...")

    # Fallback to Mailgun
    try:
        result = await send_with_mailgun(admin_email, subject, html_content)
        if result:
            return True
    except Exception as e:
        print(f"❌ Mailgun also failed: {e}")
        
    return False
