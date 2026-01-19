import os
from huggingface_hub import InferenceClient

# --- CONFIG ---
# Make sure HUGGINGFACE_API_KEY is in your .env and Render Environment
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")

async def analyze_diagram(image_url: str, topic: str):
    print(f"👁️ Analyzing Diagram with Qwen-2.5-VL: {image_url}")
    
    if not HF_TOKEN:
        print("❌ Error: HUGGINGFACE_API_KEY is missing.")
        return "System Error: Vision API key is missing."

    # Prompt Engineering for Qwen
    prompt = f"""
    You are a Physics Tutor. 
    Look at this diagram/image.
    1. Describe exactly what is visualised (vectors, graphs, machinery).
    2. Explain the scientific concept shown using a '{topic}' analogy.
    3. Keep it concise (max 3 sentences).
    """

    try:
        client = InferenceClient(api_key=HF_TOKEN)
        
        # Qwen 2.5 VL 72B is excellent for OCR and Diagrams
        # If 72B is busy/slow on free tier, you can try "Qwen/Qwen2.5-VL-7B-Instruct"
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

        # Call API
        completion = client.chat_completion(
            model=model_id,
            messages=messages,
            max_tokens=300,
            temperature=0.1
        )

        return completion.choices[0].message.content

    except Exception as e:
        print(f"❌ Hugging Face Vision Failed: {e}")
        return "I'm having trouble seeing this diagram right now. The vision service might be busy."