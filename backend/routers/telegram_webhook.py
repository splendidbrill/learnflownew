"""
Telegram Webhook Endpoint

Receives updates from Telegram bot and processes them.
"""

from fastapi import APIRouter, Request
from services.telegram_bot import handle_telegram_webhook

router = APIRouter()


@router.post("/hooks/telegram")
async def telegram_webhook(request: Request):
    """
    Webhook endpoint for Telegram bot updates.
    Telegram sends POST requests here when users interact with the bot.
    """
    update = await request.json()
    return await handle_telegram_webhook(update)
