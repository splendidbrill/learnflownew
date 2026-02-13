
import asyncio
import os
from dotenv import load_dotenv

# Force load .env
load_dotenv()

# Import the service
from services.ocr_service import extract_text_from_image, OLLAMA_MODEL, OLLAMA_BASE_URL

async def main():
    print(f"-------- OCR CONFIG --------")
    print(f"Base URL: {OLLAMA_BASE_URL}")
    print(f"Model:    {OLLAMA_MODEL}")
    print(f"----------------------------")

    # verify connectivity to ollama
    print("\n1. Testing Ollama Connectivity...")
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(OLLAMA_BASE_URL.replace("/v1", "/tags")) # /api/tags is usually the endpoint, but let's try root
            if resp.status_code == 404:
                 # try /api/tags
                 resp = await client.get(OLLAMA_BASE_URL.replace("/v1", "/api/tags"))
            
            print(f"   Ollama Status: {resp.status_code}")
            if resp.status_code == 200:
                print(f"   Available Models: {[m['name'] for m in resp.json().get('models', [])]}")
    except Exception as e:
        print(f"   ❌ Could not connect to Ollama: {e}")

    # verify function
    print("\n2. Testing extraction function (Dry Run)...")
    # We use a dummy image, it might fail to download but we want to see the LOGS from the service
    # The service prints "🔍 OCR Service (Ollama)..."
    try:
        # Use a real simple image url if possible, or just expect failure but check logs
        # Let's use a placeholder
        res = await extract_text_from_image("https://placehold.co/600x400.png", "test context")
        print(f"   Result: {res}")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
