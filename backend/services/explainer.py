# import os
# import json
# from dotenv import load_dotenv
# from openai import OpenAI

# # 1. Load secrets immediately to avoid "API Key Missing" errors
# load_dotenv()

# # 2. Initialize OpenRouter Client
# api_key = os.environ.get("OPENROUTER_API_KEY")
# if not api_key:
#     print("❌ ERROR: OPENROUTER_API_KEY is missing in .env")

# client = OpenAI(
#     base_url="https://openrouter.ai/api/v1",
#     api_key=api_key, 
# )

# def generate_explanation(content: str, interests: list, book_type: str):
#     """
#     Sends text to OpenRouter (Llama 3.2) and returns a JSON explanation.
#     """
    
#     # Format interests for the prompt
#     interests_str = ", ".join(interests) if interests else "everyday life"

#     # System Prompt: Strict JSON instructions
#     system_prompt = f"""
#     You are an expert tutor specializing in {book_type}.
#     Your goal is to explain complex text using analogies related to: {interests_str}.
    
#     CRITICAL: Return ONLY valid JSON. Do not include markdown formatting (like ```json).
    
#     Required JSON Structure:
#     {{
#         "summary": "1 sentence plain summary",
#         "analogy": "A relatable explanation using {interests_str}",
#         "key_concept": "The main technical concept",
#         "quiz_question": "A simple question to check understanding"
#     }}
#     """

#     try:
#         print(f"🧠 Sending request to Llama 3.2 for: {book_type}")
        
#         response = client.chat.completions.create(
#             model="meta-llama/llama-3.2-3b-instruct:free",  # <--- UPDATED MODEL
#             messages=[
#                 {"role": "system", "content": system_prompt},
#                 {"role": "user", "content": f"Explain this text: {content}"}
#             ],
#             temperature=0.7, # Adds a little creativity for analogies
#         )
        
#         # Clean the response (Llama sometimes adds markdown ticks)
#         raw_content = response.choices[0].message.content
#         cleaned_content = raw_content.replace("```json", "").replace("```", "").strip()
        
#         # Parse into Python Dict
#         return json.loads(cleaned_content)

#     except json.JSONDecodeError:
#         print(f"❌ JSON Error. Raw output: {raw_content}")
#         return {
#             "summary": "The AI explained it, but the format was messy.",
#             "analogy": raw_content, # Return raw text so you still see the explanation
#             "key_concept": "Parsing Error",
#             "quiz_question": "N/A"
#         }
#     except Exception as e:
#         print(f"❌ AI Error: {e}")
#         return {
#             "summary": "Could not generate explanation.",
#             "analogy": "AI is temporarily unavailable.",
#             "key_concept": "Error",
#             "quiz_question": "Try again later."
#         }

import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# 1. Load secrets
load_dotenv()
api_key = os.environ.get("OPENROUTER_API_KEY")

# 2. Define a list of free models to try (Priority Order)
MODELS = [
    "meta-llama/llama-3.2-3b-instruct:free", # Fast, usually available
    "google/gemini-2.0-flash-exp:free",      # Smartest, but often busy
    "google/gemini-exp-1206:free",           # Backup
    "microsoft/phi-3-mini-128k-instruct:free" # Last resort
]

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key, 
)

def generate_explanation(content: str, interests: list, book_type: str):
    interests_str = ", ".join(interests) if interests else "everyday life"

    system_prompt = f"""
    You are an expert tutor specializing in {book_type}.
    Your goal is to explain complex text using analogies related to: {interests_str}.
    
    CRITICAL: Return ONLY valid JSON. Do not include markdown formatting (like ```json).
    
    Required JSON Structure:
    {{
        "summary": "1 sentence plain summary",
        "analogy": "A relatable explanation using {interests_str}",
        "key_concept": "The main technical concept",
        "quiz_question": "A simple question to check understanding"
    }}
    """

    # 3. Loop through models until one works
    for model in MODELS:
        try:
            print(f"🧠 Trying model: {model}...")
            
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Explain this text: {content}"}
                ],
                temperature=0.7,
            )
            
            # If we get here, it worked!
            raw_content = response.choices[0].message.content
            cleaned_content = raw_content.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned_content)

        except Exception as e:
            print(f"⚠️ Model {model} failed: {e}")
            continue # Try the next model in the list

    # 4. If ALL models fail
    print("❌ All models failed.")
    return {
        "summary": "High traffic on all AI models.",
        "analogy": "Please try again in 1 minute.",
        "key_concept": "Rate Limit",
        "quiz_question": "N/A"
    }