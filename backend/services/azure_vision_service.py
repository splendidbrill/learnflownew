import os
import time
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

# Configuration
# Endpoint likely: https://<resource>.cognitiveservices.azure.com/
AZURE_VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT", "")
if not AZURE_VISION_ENDPOINT.endswith("/"):
    AZURE_VISION_ENDPOINT += "/"

AZURE_VISION_KEY = os.getenv("AZURE_VISION_API_KEY", "") or os.getenv("AZURE_VISION_KEY", "")

print(f"🔍 OCR Service: Azure AI Vision (Read API)")

async def extract_text_with_azure_vision(image_bytes: bytes) -> str:
    """
    Extract text using Azure Computer Vision Read API 3.2 (Direct HTTP).
    Robust, Fast, No Hallucinations.
    """
    if not AZURE_VISION_ENDPOINT or not AZURE_VISION_KEY:
        print("❌ OCR: Missing AZURE_VISION_ENDPOINT or AZURE_VISION_KEY")
        return ""

    start = time.time()
    
    # 1. Analyze (POST)
    analyze_url = f"{AZURE_VISION_ENDPOINT}vision/v3.2/read/analyze"
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_VISION_KEY,
        "Content-Type": "application/octet-stream"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(analyze_url, content=image_bytes, headers=headers)
            
            if resp.status_code != 202:
                print(f"❌ Vision API Failed: {resp.status_code} - {resp.text}")
                return ""
            
            operation_url = resp.headers["Operation-Location"]

            # 2. Poll for Result (GET)
            for _ in range(10): # Try for 10 seconds
                await asyncio.sleep(1)
                result_resp = await client.get(operation_url, headers={"Ocp-Apim-Subscription-Key": AZURE_VISION_KEY})
                
                if result_resp.status_code == 200:
                    data = result_resp.json()
                    status = data["status"]
                    
                    if status == "succeeded":
                        # Extract Text
                        lines = []
                        read_results = data.get("analyzeResult", {}).get("readResults", [])
                        for page in read_results:
                            for line in page.get("lines", []):
                                lines.append(line["text"])
                        
                        full_text = "\n".join(lines)
                        elapsed = time.time() - start
                        
                        # DEBUG
                        print(f"   👁️ Vision OCR: {len(full_text)} chars in {elapsed:.2f}s")
                        
                        # 3. Format with LLM (DeepSeek/GPT-4o)
                        formatted_text = await _format_with_llm(full_text)
                        return formatted_text
                    
                    if status == "failed":
                        print("❌ Vision API Job Failed")
                        return ""
                else:
                    print(f"⚠️ Polling Error: {result_resp.status_code}")
            
            print("❌ Vision API Timed Out")
            return ""

    except Exception as e:
        print(f"❌ Vision OCR Error: {e}")
        return ""

    import asyncio
    
    # Retry Loop for 429
    for attempt in range(3):
        try:
            from openai import AsyncOpenAI
            
            # Use DeepSeek/Text LLM config from Env
            client = AsyncOpenAI(
                base_url=os.getenv("AZURE_TEXT_BASE_URL"),
                api_key=os.getenv("AZURE_TEXT_API_KEY"),
            )
            
            model = os.getenv("AZURE_TEXT_MODEL", "DeepSeek-V3")
            
            prompt = f"""You are a Technical Book Formatter.
Input is RAW text from a PDF page (Physics/CS).
Task: Format it into Clean Markdown maximizing readability.

STRICT Rules:
1. **REMOVE HEADERS/FOOTERS**: Delete lines like "Let Us C", "Chapter 3", or "Page 163" from the top/bottom.
2. **Merge Continuous Code/Output**: If lines look like program output or code (e.g., "I am in case 2...", "I am in case 3..."), combine them into ONE single code block (```text or ```c). Do NOT split them.
3. **Format Math**: Use LaTeX ($...$) for equations.
4. **Format Code**: Use backticks for inline code (`int x`) and blocks for multi-line code.
5. **Preserve Paragraphs**: Do not merge distinct text paragraphs.
6. Output ONLY the formatted markdown.

RAW TEXT:
{raw_text[:3000]}...
"""
            # Note: Sending full text, up to limit. 
            # DeepSeek has 64k context, so full text is fine.
            
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt.replace("{raw_text[:3000]}... (truncated for context if huge)", raw_text)}],
                temperature=0.1,
                max_tokens=4000
            )
            
            formatted = response.choices[0].message.content.strip()
            print(f"   ✨ DeepSeek Formatted: {len(formatted)} chars")
            return formatted

        except Exception as e:
            if "429" in str(e):
                unique_wait = (3 * (attempt + 1))
                print(f"   ⏳ DeepSeek Formatting 429. Retrying in {unique_wait}s...")
                await asyncio.sleep(unique_wait)
            else:
                print(f"⚠️ Formatting Failed: {e}")
                return raw_text # Fallback to raw text only on non-retryable error
    
    print("❌ DeepSeek Formatting Failed after retries")
    return raw_text
