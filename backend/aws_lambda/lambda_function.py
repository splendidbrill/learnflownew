import json
import os
import urllib3

# Initialize HTTP client
http = urllib3.PoolManager()

def lambda_handler(event, context):
    """
    AWS Lambda Function to send Telegram Alerts.
    Triggered by EventBridge Scheduler.
    
    Expected Event Payload:
    {
        "chat_id": "123456789",
        "message": "Study time!",
        "buttons": [["Button Text", "CALLBACK_DATA"]] (Optional)
    }
    """
    print(f"🔔 Event Received: {json.dumps(event)}")
    
    # 1. Get Configuration
    BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not BOT_TOKEN:
        print("❌ Error: TELEGRAM_BOT_TOKEN not found in environment variables")
        return {"statusCode": 500, "body": "Missing Configuration"}

    # 2. Parse Payload
    chat_id = event.get('chat_id')
    text = event.get('message')
    buttons = event.get('buttons', [])

    if not chat_id or not text:
        print("❌ Error: Missing chat_id or message")
        return {"statusCode": 400, "body": "Missing Parameters"}

    # 3. Build Request
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }

    if buttons:
        # Construct Inline Keyboard
        # Expected buttons format: [["Text", "Data"], ["Text2", "Data2"]]
        keyboard = []
        
        # Simple list of buttons -> List of Lists
        # If payload is just ["Btn", "Data"], wrap it
        if isinstance(buttons[0], str):
             keyboard.append([{"text": buttons[0], "callback_data": buttons[1]}])
        else:
            row = []
            for btn in buttons:
                row.append({"text": btn[0], "callback_data": btn[1]})
                if len(row) == 2: # Max 2 buttons per row
                    keyboard.append(row)
                    row = []
            if row: 
                keyboard.append(row)
            
        payload["reply_markup"] = {"inline_keyboard": keyboard}

    # 4. Send Request
    try:
        encoded_payload = json.dumps(payload).encode('utf-8')
        resp = http.request(
            'POST',
            url,
            body=encoded_payload,
            headers={'Content-Type': 'application/json'}
        )
        
        response_data = json.loads(resp.data.decode('utf-8'))
        
        if resp.status != 200:
            print(f"❌ Telegram API Error: {response_data}")
            return {"statusCode": resp.status, "body": json.dumps(response_data)}
            
        print(f"✅ Message sent successfully to {chat_id}")
        return {"statusCode": 200, "body": "Message Sent"}

    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return {"statusCode": 500, "body": str(e)}
