import base64
import os
import re
import httpx
import fitz  # PyMuPDF

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")

# Roboflow serverless LMM endpoint for GLM-OCR
_LMM_URL = "https://serverless.roboflow.com/infer/lmm"


def pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Convert each PDF page to a JPEG image at 2x zoom for better OCR accuracy."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    mat = fitz.Matrix(2.0, 2.0)
    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        images.append(pix.tobytes("jpeg"))
    doc.close()
    return images


async def ocr_image_roboflow(image_bytes: bytes) -> str:
    """
    Send a single page image to the Roboflow GLM-OCR serverless LMM endpoint.
    Returns the extracted text for that page.
    """
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "api_key": ROBOFLOW_API_KEY,
        "image": {"type": "base64", "value": b64},
        "model_id": "glm-ocr",
        "prompt": "Text Recognition:",
        "max_new_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(_LMM_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()

    # GLM-OCR returns {"response": "..."} or {"output": "..."}
    if isinstance(data, dict):
        if "response" in data:
            return str(data["response"])
        if "output" in data:
            return str(data["output"])
        if "text" in data:
            return str(data["text"])

    return str(data)


# ---------------------------------------------------------------------------
# Chapter detection
# ---------------------------------------------------------------------------

# Matches explicit chapter/part labels only — short lines, not sentences
_CHAPTER_RE = re.compile(
    r"^(chapter\s+[\divxlcdmIVXLCDM]+|part\s+[\divxlcdmIVXLCDM]+)[\s:\-–—]*",
    re.IGNORECASE,
)

# Matches ALL-CAPS short lines (likely section/chapter titles in textbooks)
_ALLCAPS_RE = re.compile(r"^[A-Z][A-Z\s\d\-–:]{3,50}$")


def _is_chapter_heading(line: str) -> bool:
    """Return True only for lines that look like chapter/section headings."""
    line = line.strip()
    # Must be short enough to be a title (not a question or sentence)
    if len(line) > 80:
        return False
    # Explicit "Chapter N" or "Part N"
    if _CHAPTER_RE.match(line):
        return True
    # All-caps short line (e.g. "INTRODUCTION TO PHYSICS")
    if _ALLCAPS_RE.match(line):
        return True
    return False


def detect_chapters(pages_text: list[str]) -> list[dict]:
    """
    Group OCR'd page texts into chapters by looking for chapter headings
    in the first three lines of each page.

    Returns a list of dicts: {number, title, content, page_start, page_end}
    """
    chapters: list[dict] = []
    current: dict = {
        "number": 0,
        "title": "Introduction",
        "page_start": 1,
        "parts": [],
    }

    for page_idx, page_text in enumerate(pages_text):
        page_num = page_idx + 1
        lines = [l.strip() for l in page_text.splitlines() if l.strip()]

        heading_found = False
        # Only check the first 3 lines — headings are at the top of the page
        for line in lines[:3]:
            if _is_chapter_heading(line):
                if current["parts"] or chapters:
                    current["page_end"] = page_num - 1
                    current["content"] = "\n\n".join(current["parts"])
                    chapters.append(_strip_parts(current))

                current = {
                    "number": len(chapters) + 1,
                    "title": line[:200],
                    "page_start": page_num,
                    "parts": [page_text],
                }
                heading_found = True
                break

        if not heading_found:
            current["parts"].append(page_text)

    # Flush last chapter
    current["page_end"] = len(pages_text)
    current["content"] = "\n\n".join(current["parts"])
    chapters.append(_strip_parts(current))

    # If nothing detected, treat whole book as one section
    if not chapters or (len(chapters) == 1 and chapters[0]["number"] == 0):
        return [{
            "number": 1,
            "title": "Full Content",
            "content": "\n\n".join(pages_text),
            "page_start": 1,
            "page_end": len(pages_text),
        }]

    return chapters


def _strip_parts(chapter: dict) -> dict:
    return {k: v for k, v in chapter.items() if k != "parts"}
