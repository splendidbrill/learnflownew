"""
Vision Service - Placeholder (SiliconFlow Removed)
"""

import os
from dotenv import load_dotenv

load_dotenv()

# --- NO EXTERNAL VISION SERVICE ---




async def describe_image(image_url: str, context_text: str = "") -> str:
    """
    Get a factual description of an image (cached per image).
    """
    return "Image description unavailable (Vision Service Disabled)"


async def analyze_diagram(image_url: str, topic: str, context_text: str = "") -> str:
    """
    Analyzes a diagram with personalized analogies.
    """
    return f"I cannot analyze this diagram directly, but based on the context '{context_text}', it relates to {topic}."


async def is_valid_diagram(image_bytes: bytes) -> bool:
    """
    Determines if an image is a real educational diagram.
    """
    # Simply return True to keep all images since we don't have a vision model to filter.
    # This avoids deleting valid diagrams.
    return True