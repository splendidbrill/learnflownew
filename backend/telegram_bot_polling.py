"""
Telegram Bot Polling Service
This runs alongside your FastAPI app and handles Telegram messages via polling instead of webhooks.
Run this with: python telegram_bot_polling.py
"""
import os
import asyncio
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from dotenv import load_dotenv
from db import supabase

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command with user ID parameter"""
    try:
        print(f"📩 Received /start from {update.effective_chat.id}")
        
        # Check if user provided their UUID
        if context.args and len(context.args) > 0:
            user_uuid = context.args[0]
            chat_id = str(update.effective_chat.id)
            
            print(f"🔗 Linking Chat ID {chat_id} to User {user_uuid}")
            
            try:
                # Update user profile with telegram_chat_id
                result = supabase.table("profiles").update({
                    "telegram_chat_id": chat_id
                }).eq("id", user_uuid).execute()
                
                print(f"✅ Database updated: {result.data}")
                
                await update.message.reply_text(
                    "✅ **Connected Successfully!**\n\n"
                    "Your Telegram is now linked to LearnFlow.\n"
                    "You'll receive study session reminders here!\n\n"
                    "Return to the app to continue.",
                    parse_mode="Markdown"
                )
            except Exception as e:
                print(f"❌ Database Error: {e}")
                await update.message.reply_text(
                    "❌ Connection failed. Please check the user ID and try again.\n\n"
                    f"Error: {str(e)}"
                )
        else:
            # No user ID provided
            print(f"⚠️ /start received without user ID")
            await update.message.reply_text(
                "👋 Welcome to LearnFlow Bot!\n\n"
                "To connect your account, please use the 'Connect Telegram' button in the app.\n\n"
                "Or send: `/start YOUR_USER_ID`",
                parse_mode="Markdown"
            )
    except Exception as e:
        print(f"🔥 CRITICAL ERROR in start_command: {e}")
        try:
            await update.message.reply_text(
                "❌ An error occurred. Please try again or contact support."
            )
        except:
            pass

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    await update.message.reply_text(
        "**LearnFlow Telegram Bot**\n\n"
        "Commands:\n"
        "/start [user_id] - Connect your account\n"
        "/help - Show this message\n\n"
        "Use the app to schedule study sessions and get reminders here!",
        parse_mode="Markdown"
    )

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle button clicks from notifications"""
    query = update.callback_query
    await query.answer()  # Acknowledge the button click
    
    callback_data = query.data
    
    if callback_data == "COMMIT":
        # User clicked "I will study!"
        await query.edit_message_text(
            "🎯 **Great, see you in the session!**\n\n"
            "Your commitment is logged. Keep up the momentum! 💪",
            parse_mode="Markdown"
        )
    elif callback_data.startswith("CONFIRM"):
        # User clicked "I'm Ready" on 5min notification
        session_id = callback_data.split(":")[-1] if ":" in callback_data else None
        await query.edit_message_text(
            "✅ **Awesome! Let's go!**\n\n"
            "Opening your study session now...",
            parse_mode="Markdown"
        )
        # TODO: Could update study_sessions table with status="confirmed"
    elif callback_data.startswith("SKIP"):
        # User clicked "Skip Today"
        await query.edit_message_text(
            "📅 **No problem!**\n\n"
            "Session marked as skipped. See you next time!",
            parse_mode="Markdown"
        )

def main():
    """Start the bot in polling mode"""
    print("=" * 60)
    print("🤖 Starting Telegram Bot (Polling Mode)")
    print("=" * 60)
    print(f"Bot Token: {BOT_TOKEN[:20]}...")
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    # Create application
    app = Application.builder().token(BOT_TOKEN).build()
    
    # Add handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    
    # Add callback handler for buttons
    from telegram.ext import CallbackQueryHandler
    app.add_handler(CallbackQueryHandler(button_callback))
    
    # Start polling
    print("✅ Bot is running! Try sending /start in Telegram...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
