"""
Vision Service - Diagram analysis using Azure GPT-4.1 mini
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

print(f"👁️ Vision Service: Azure GPT-4.1 mini")


async def describe_image(image_url: str, context_text: str = "") -> str:
    """
    Get a factual description of an image (cached per image).
    This is the ONE-TIME call when book is uploaded.
    Returns plain description without personalization.
    """
    prompt = f"""
    You are an expert at describing educational diagrams.
    
    CONTEXT: This image is from a chapter about "{context_text}".
    
    TASK: Describe this image factually and completely:
    1. List all text labels visible in the image
    2. Identify what type of diagram this is (flowchart, anatomy, graph, etc.)
    3. Describe the key elements, their relationships, and what concept it illustrates
    
    Be thorough but concise. This description will be used to generate personalized explanations later.
    Keep under 200 words.
    """
    
    return await _azure_vision(image_url, prompt)


async def analyze_diagram(image_url: str, topic: str, context_text: str = "") -> str:
    """
    Analyzes a diagram with personalized analogies using Azure GPT-4.1 mini.
    """
    print(f"👁️ Analyzing with {AZURE_VISION_DEPLOYMENT} | Context: {context_text}")
    
    if not AZURE_VISION_API_KEY or not AZURE_VISION_ENDPOINT:
        return "System Error: Azure Vision credentials missing in .env"
    
    prompt = f"""
    You are an expert personalized Tutor.
    
    CONTEXT: The student is reading a chapter titled "{context_text}".
    USER INTEREST: {topic} (Use this for analogies).

    TASK:
    1. **READ LABELS**: First, list the text labels you see inside the image.
    2. **IDENTIFY**: Based on the labels and the chapter context, what exactly is this diagram showing?
    3. **ANALOGY**: Explain the concept using a '{topic}' analogy. 
       - Map the visual elements (arrows, circles, containers) to elements of {topic}.
    
    Keep the explanation clear, encouraging, and under 150 words.
    """
    
    return await _azure_vision(image_url, prompt)


async def _azure_vision(image_url: str, prompt: str) -> str:
    """Azure OpenAI Vision implementation"""
    if not AZURE_VISION_API_KEY or not AZURE_VISION_ENDPOINT:
        return "System Error: Azure Vision credentials missing in .env"
    
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
            max_tokens=800, 
            temperature=0.3
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"❌ Azure Vision Failed: {e}")
        return f"I couldn't analyze this image. Azure Error: {str(e)}"


async def is_valid_diagram(image_bytes: bytes) -> bool:
    """
    Uses GPT-4.1 mini to determine if an image is a real educational diagram
    vs a watermark, background, or decorative element.
    
    Returns True if it's a valid diagram to keep, False if it should be filtered out.
    """
    if not AZURE_VISION_API_KEY or not AZURE_VISION_ENDPOINT:
        print("⚠️ No Azure Vision credentials, skipping filter (keeping image)")
        return True  # Fail open
    
    try:
        import base64
        import io
        try:
            from PIL import Image
        except ImportError:
            print("⚠️ Pillow not installed! Skipping optimization. (pip install Pillow)")
            # Fallback: Treat as valid to avoid crash, OR try to send raw bytes if possible?
            # sending raw bytes (image_bytes) is fine if < 20MB.
            # But let's just return True to be safe and fast.
            return True

        # Optimize Image: Resize & Compress to JPEG
        # This dramatically reduces API latency and cost
        img = Image.open(io.BytesIO(image_bytes))
        
        # Resize if too large (max 512px)
        if img.width > 512 or img.height > 512:
            img.thumbnail((512, 512))
            
        # Convert to JPEG with quality 60
        buffer = io.BytesIO()
        img = img.convert("RGB") # Ensure RGB for JPEG
        img.save(buffer, format="JPEG", quality=60)
        optimized_bytes = buffer.getvalue()
        
        # Convert to base64
        image_b64 = base64.b64encode(optimized_bytes).decode('utf-8')
        data_url = f"data:image/jpeg;base64,{image_b64}"
        
        prompt = """
        Look at this image from an educational textbook.
        
        Is this a meaningful educational diagram such as:
        - A scientific illustration (biology, physics, chemistry)
        - A flowchart or process diagram
        - A graph, chart, or data visualization
        - A technical drawing with labels
        
        Or is this NOT educational content, such as:
        - A watermark or logo
        - A decorative pattern
        - A blank or nearly blank area
        
        Answer only YES if educational, or NO if not educational.
        """
        
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
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            max_tokens=10,  # Only need YES or NO
            temperature=0.1  # Very deterministic
        )

        answer = response.choices[0].message.content.strip().upper()
        is_valid = "YES" in answer
        
        print(f"   🔍 Vision Filter: {'✅ KEEP' if is_valid else '❌ SKIP'}")
        return is_valid
        
    except Exception as e:
        print(f"⚠️ Vision filter failed: {e}, keeping image")
        return True  # Fail open