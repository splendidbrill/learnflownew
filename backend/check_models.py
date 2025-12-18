import os
from dotenv import load_dotenv
import google.generativeai as genai
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("❌ Error: GOOGLE_API_KEY is missing.")
else:
    genai.configure(api_key=api_key)
    print("--- 🔍 AVAILABLE MODELS ---")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"✅ Found: {m.name}")
    except Exception as e:
        print(f"❌ Error connecting to Google: {e}")