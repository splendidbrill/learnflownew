import os
import base64
import time
import asyncio
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# Configuration
AZURE_KIMI_ENDPOINT = os.getenv("AZURE_KIMI_ENDPOINT", "https://farcast-resource.services.ai.azure.com/openai/v1/")
# Clean the endpoint for Azure SDK (must be base resource URL)
if "/openai/v1" in AZURE_KIMI_ENDPOINT:
    AZURE_KIMI_ENDPOINT = AZURE_KIMI_ENDPOINT.split("/openai/v1")[0]
if "/chat/completions" in AZURE_KIMI_ENDPOINT:
    AZURE_KIMI_ENDPOINT = AZURE_KIMI_ENDPOINT.split("/chat/completions")[0]
# Remove trailing slash
if AZURE_KIMI_ENDPOINT.endswith("/"): AZURE_KIMI_ENDPOINT = AZURE_KIMI_ENDPOINT[:-1]

AZURE_KIMI_KEY = os.getenv("AZURE_TEXT_API_KEY", "") 
AZURE_KIMI_MODEL = "Kimi-K2.6"
API_VERSION = "2024-05-01-preview"

print(f"🔍 OCR Service: Azure Kimi K2.6 ({AZURE_KIMI_MODEL}) [Azure SDK] - Refined")

def _resize_image_bytes(image_bytes: bytes, max_dim: int = 2048) -> bytes:
    """Resize image to save tokens/bandwidth (2048px for clarity)"""
    from io import BytesIO
    try:
        from PIL import Image
        img = Image.open(BytesIO(image_bytes))
        w, h = img.size
        # Kimi handles large images well, but 2048 is a good balance
        if max(w, h) > max_dim:
            ratio = max_dim / max(w, h)
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    except Exception as e:
        print(f"⚠️ Image resize failed: {e}")
        return image_bytes

async def extract_text_with_kimi(image_bytes: bytes) -> str:
    """
    Extract text using Azure AI Kimi K2.5 (Azure OpenAI SDK).
    """
    if not AZURE_KIMI_ENDPOINT or not AZURE_KIMI_KEY:
        print("❌ OCR: Missing AZURE_KIMI_ENDPOINT or AZURE_TEXT_API_KEY")
        return ""

    start = time.time()
    
    # 1. Prepare Image
    image_bytes = _resize_image_bytes(image_bytes, max_dim=2048)
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    data_url = f"data:image/png;base64,{image_b64}"

    # 2. PROMPT (Strict Formatting for "Let Us C" and Code Merging)
    prompt = """You are a Technical Book OCR Assistant.
Extract text from the image into Clean Markdown.

STRICT Rules:
1. **REMOVE HEADERS/FOOTERS**: Delete lines like "Let Us C", "Chapter 3", or "Page 163" from the top/bottom.
2. **Merge Continuous Code/Output**: If lines look like program output or code (e.g., "I am in case 2...", "I am in case 3..."), combine them into ONE single code block (```text or ```c). Do NOT split them.
3. **Format Math**: Use LaTeX ($...$) for equations.
4. **Format Code**: Use backticks for inline code (`int x`) and blocks for multi-line code.
5. **Preserve Paragraphs**: Do not merge distinct text paragraphs.
6. Output ONLY the formatted markdown.
"""

    client = AsyncAzureOpenAI(
        azure_endpoint=AZURE_KIMI_ENDPOINT,
        api_key=AZURE_KIMI_KEY,
        api_version=API_VERSION,
        azure_deployment=AZURE_KIMI_MODEL,
        timeout=120.0 # Increased timeout for robustness
    )

    # Retry loop for 429 Rate Limits and None Responses
    for attempt in range(4):
        try:
            response = await client.chat.completions.create(
                model=AZURE_KIMI_MODEL, 
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url}}
                        ]
                    }
                ],
                max_tokens=4096,
                temperature=0.1
            )
            
            content = response.choices[0].message.content
            if not content:
                finish_reason = response.choices[0].finish_reason
                print(f"⚠️ Kimi OCR Returned None. Finish Reason: {finish_reason}")
                if finish_reason == "content_filter":
                    return "" # Can't retry safety filter
                continue # Retry if it's just a glitch
            
            text = content.strip()
            elapsed = time.time() - start
            print(f"   🌙 Kimi OCR: {len(text)} chars in {elapsed:.2f}s")
            return text

        except Exception as e:
            if "429" in str(e):
                unique_wait = (5 * (attempt + 1)) + (time.time() % 1)
                print(f"   ⏳ Kimi 429 Limit. Retrying in {unique_wait:.1f}s...")
                await asyncio.sleep(unique_wait)
            else:
                print(f"❌ Kimi OCR Failed: {e}")
                # Don't break immediately, maybe retry? 
                # Actually for non-429 errors, retrying might not help unless it's network.
                await asyncio.sleep(2)
    
    print("❌ Kimi OCR: Failed after 4 retries")
    return ""
