import os
import httpx
from huggingface_hub import InferenceClient

# --- CONFIG ---
# Add this to your .env / Render Environment: HUGGINGFACE_API_KEY
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")

# --- QWEN LOGIC (Hugging Face) ---
async def try_huggingface_qwen(image_url, prompt):
    print("🤖 Vision: Calling Qwen-2.5-VL via Hugging Face...")
    
    if not HF_TOKEN:
        print("⚠️ No HUGGINGFACE_API_KEY found.")
        return None

    try:
        client = InferenceClient(api_key=HF_TOKEN)
        
        # Qwen-2.5-VL is excellent for OCR and Diagrams
        # We use the 72B Instruct model (or 7B if 72B is busy)
        model_id = "Qwen/Qwen2.5-VL-72B-Instruct" 

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "url": image_url},
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        # Call the API
        completion = client.chat_completion(
            model=model_id,
            messages=messages,
            max_tokens=500,
            temperature=0.1 # Low temperature for factual accuracy
        )

        return completion.choices[0].message.content

    except Exception as e:
        print(f"⚠️ Qwen Failed: {e}")
        return None

# --- MAIN ORCHESTRATOR ---
async def analyze_diagram(image_url: str, topic: str):
    """
    Tries to analyze the diagram using available providers.
    """
    prompt = f"""
    You are a Physics Tutor. 
    Analyze this diagram image carefully.
    1. Describe exactly what is shown (vectors, labels, shapes).
    2. Explain the scientific concept using a '{topic}' analogy.
    Keep it concise and helpful.
    """

    # 1. Validate Image URL (Quick Check)
    if not image_url or "http" not in image_url:
        return "Invalid image source."

    # 2. Try Qwen (Since you have this key!)
    explanation = await try_huggingface_qwen(image_url, prompt)
    if explanation:
        return explanation

    # (Optional: Add Gemini/GPT-4o fallbacks here later)

    return "I couldn't analyze this image right now. The AI vision service is busy."