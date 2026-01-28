import edge_tts
import uuid
import os
import tempfile # <--- Safer for Windows
from langchain_core.messages import HumanMessage, SystemMessage

# Voice Mapping
VOICES = {
    "english": "en-US-AndrewNeural",
    "hindi": "hi-IN-MadhurNeural",
    "spanish": "es-ES-AlvaroNeural",
    "chinese": "zh-CN-YunxiNeural"
}

async def generate_audio(text: str, language: str, llm):
    target_lang = language.lower()
    voice = VOICES.get(target_lang, "en-US-AndrewNeural")
    
    text_to_speak = text

    # 1. TRANSLATION LAYER
    if target_lang != "english":
        print(f"🌐 Translating to {target_lang}...")
        prompt = f"Translate the following educational text into natural, spoken {target_lang}. Keep the meaning accurate but easy to listen to. Do NOT add extra conversational filler:\n\n{text}"
        
        try:
            response = await llm.ainvoke([
                SystemMessage(content="You are a professional translator."),
                HumanMessage(content=prompt)
            ])
            text_to_speak = response.content
        except Exception as e:
            print(f"⚠️ Translation failed: {e}")
            # Fallback: Speak English if translation fails
            voice = "en-US-AndrewNeural" 

    # 2. TTS GENERATION
    # Use tempfile to work on Windows/Linux/Mac
    temp_dir = tempfile.gettempdir()
    filename = f"{uuid.uuid4()}.mp3"
    output_file = os.path.join(temp_dir, filename)
    
    try:
        communicate = edge_tts.Communicate(text_to_speak, voice)
        await communicate.save(output_file)
        return output_file, text_to_speak
    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return None, None