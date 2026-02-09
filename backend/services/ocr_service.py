"""
OCR Service - Extract text from images using Azure Vision
"""

import os
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# --- AZURE CONFIGURATION ---
AZURE_VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT")
AZURE_VISION_API_KEY = os.getenv("AZURE_VISION_API_KEY")
AZURE_VISION_DEPLOYMENT = os.getenv("AZURE_VISION_DEPLOYMENT")
AZURE_VISION_API_VERSION = os.getenv("AZURE_VISION_API_VERSION")


async def extract_text_from_image(image_url: str, context: str = "educational content") -> dict:
    """
    Use Azure Vision (GPT-4o mini) to OCR an image and extract all text.
    
    Args:
        image_url: Public URL of the image
        context: Context hint for better extraction (e.g., "physics textbook")
    
    Returns:
        {
            "success": True,
            "text": "Extracted text content...",
            "has_exercises": True/False,
            "has_diagrams": True/False
        }
    """
    if not AZURE_VISION_API_KEY or not AZURE_VISION_ENDPOINT:
        print("❌ OCR Service: Missing Credentials")
        return {"success": False, "error": "Azure Vision credentials missing"}
    
    print(f"🔍 OCR Service: Extracting text from {image_url}...")
    
    prompt = f"""
You are an expert at extracting text from educational materials.

CONTEXT: This image is from a {context}.

TASK: Extract ALL readable text from this image.

INSTRUCTIONS:
1. Read every piece of text visible in the image
2. Preserve the structure (headings, paragraphs, lists, questions)
3. For math equations, write them in a readable format (e.g., "a² + b² = c²")
4. If there are numbered questions or exercises, keep them numbered
5. Ignore decorative elements, page numbers, and watermarks

Also tell me:
- Does this page contain exercise questions? (numbered questions at end of section)
- Does this page contain diagrams that need visual explanation?

OUTPUT FORMAT (JSON):
{{
    "text": "The full extracted text...",
    "has_exercises": true/false,
    "has_diagrams": true/false
}}

Return ONLY valid JSON.
"""
    
    try:
        client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_VISION_ENDPOINT,
            api_key=AZURE_VISION_API_KEY,
            api_version=AZURE_VISION_API_VERSION
        )

        response = await client.chat.completions.create(
            model=AZURE_VISION_DEPLOYMENT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
            max_tokens=2000,
            temperature=0.1
        )

        content = response.choices[0].message.content.strip()
        
        # Clean markdown if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()
        
        import json
        result = json.loads(content)
        result["success"] = True
        return result

    except Exception as e:
        print(f"❌ OCR Failed: {e}")
        return {"success": False, "error": str(e)}


async def is_text_heavy_image(image_url: str) -> bool:
    """
    Quick check to see if an image contains significant text.
    Returns True if the image appears to be a text-heavy page.
    """
    if not AZURE_VISION_API_KEY or not AZURE_VISION_ENDPOINT:
        return False
    
    prompt = """
Look at this image. Is it primarily text content (like a textbook page)?
Answer with ONLY "yes" or "no".
"""
    
    try:
        client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_VISION_ENDPOINT,
            api_key=AZURE_VISION_API_KEY,
            api_version=AZURE_VISION_API_VERSION
        )

        response = await client.chat.completions.create(
            model=AZURE_VISION_DEPLOYMENT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
            max_tokens=10,
            temperature=0
        )

        answer = response.choices[0].message.content.strip().lower()
        return "yes" in answer

    except Exception as e:
        print(f"⚠️ Text-heavy check failed: {e}")
        return False
