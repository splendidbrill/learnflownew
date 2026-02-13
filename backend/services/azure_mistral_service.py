import os
import base64
import time
import asyncio
import httpx
from dotenv import load_dotenv
import re
import io
from PIL import Image

load_dotenv()

# Configuration
# User provided: https://tusharkarancan-8328-resource.services.ai.azure.com/providers/mistral/azure/ocr
MISTRAL_ENDPOINT = "https://tusharkarancan-8328-resource.services.ai.azure.com/providers/mistral/azure/ocr"
MISTRAL_KEY = os.getenv("AZURE_TEXT_API_KEY", "") 
if os.getenv("AZURE_MISTRAL_KEY"):
    MISTRAL_KEY = os.getenv("AZURE_MISTRAL_KEY")

MISTRAL_MODEL = "mistral-document-ai-2505"

print(f"🔍 OCR Service: Azure Mistral Document AI ({MISTRAL_MODEL})")

async def extract_text_with_mistral(image_bytes: bytes, domain: str = "general") -> str:
    """
    Extract text using Mistral Document AI (OCR).
    Format: Markdown.
    Includes Smart Image Filtering (Domain-Aware) and HTML Table Cleanup.
    
    Args:
        image_bytes: The PDF page rendered as image.
        domain: Context (e.g., 'math', 'physics', 'cs') to adjust filtering rules.
    """
    if not MISTRAL_KEY:
        print("❌ OCR: Missing AZURE_MISTRAL_KEY or AZURE_TEXT_API_KEY")
        return ""

    start = time.time()
    domain_lower = domain.lower()
    
    # Domain Flags
    is_math = "math" in domain_lower or "calculus" in domain_lower or "algebra" in domain_lower
    is_physics = "physics" in domain_lower or "science" in domain_lower or "biology" in domain_lower

    print(f"🔹 Mistral OCR Start (Smart Mode: {domain} | Math={is_math}, Physics={is_physics})...")
    
    # 1. Encode Image
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    data_url = f"data:image/png;base64,{image_b64}"

    # 2. Payload
    payload = {
        "model": MISTRAL_MODEL,
        "document": {
            "type": "image_url",
            "image_url": data_url
        },
        "include_image_base64": True  # Enable for Size Filtering & Injection
    }

    headers = {
        "Authorization": f"Bearer {MISTRAL_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(MISTRAL_ENDPOINT, json=payload, headers=headers)
            
            if resp.status_code != 200:
                # Try with api-key header if 401
                if resp.status_code == 401:
                    headers = {
                        "api-key": MISTRAL_KEY,
                        "Content-Type": "application/json"
                    }
                    resp = await client.post(MISTRAL_ENDPOINT, json=payload, headers=headers)
                
                if resp.status_code != 200:
                    print(f"❌ Mistral OCR Failed: {resp.status_code} - {resp.text}")
                    return ""
            
            data = resp.json()
            
            # --- 3. Process Response (Inject Images + Convert Tables) ---
            markdown_text = ""
            
            # Build Image Map (id -> base64)
            image_map = {}
            if "images" in data:
                for img_obj in data["images"]:
                    img_id = img_obj.get("id")
                    img_data = img_obj.get("image_base64")
                    if img_id and img_data:
                        image_map[img_id] = img_data

            if "pages" in data:
                for page in data["pages"]:
                    page_md = page.get("markdown", "")
                    
                    # --- A. Inject Images & Smart Filter ---
                    def replace_image_ref(match):
                        alt = match.group(1)
                        ref_id = match.group(2) # e.g. "img-0.jpeg"
                        
                        target_b64 = None
                        if ref_id in image_map:
                            target_b64 = image_map[ref_id]
                        
                        if target_b64:
                            try:
                                # Apply Size Filter based on Domain
                                img_bytes_decoded = base64.b64decode(target_b64)
                                with Image.open(io.BytesIO(img_bytes_decoded)) as img:
                                    width, height = img.size
                                    ratio = width / max(height, 1) # Width/Height
                                    
                                    # 1. Filter Full Page Snaps (Always Bad)
                                    if height > 800:
                                        print(f"   ⚠️ Filtered Full Page (h={height})")
                                        return ""
                                    
                                    # --- SMART LOGIC ---
                                    
                                    # CASE A: MATH (Keep Equations)
                                    if is_math:
                                        # Equations are often short (<50px) and wide (Ratio > 3).
                                        # Standard rule filters them. Math rule KEEPS them.
                                        if height > 15: 
                                             return f"![Equation](data:image/jpeg;base64,{target_b64})"
                                        # Tiny noise (<15px) is still removed
                                        return ""

                                    # CASE B: PHYSICS (Keep Diagrams)
                                    # Diagrams are Boxy (Ratio < 2).
                                    # Standard rule might filter small diagrams. Physics rule protects them.
                                    if is_physics:
                                        if height > 30:
                                            return f"![Diagram](data:image/jpeg;base64,{target_b64})"
                                        return ""

                                    # CASE C: GENERAL (Default Heuristic)
                                    # Filter Equations (Small & Wide)
                                    # If height < 50 AND Ratio > 3: Likely Equation line -> Remove
                                    if height < 50 and ratio > 3:
                                        return ""
                                    
                                    # Filter Noise (Tiny)
                                    if height < 20 or width < 20:
                                        return ""

                                    # Keep Diagrams (Boxy or Large)
                                    print(f"   ✅ Kept Image: {width}x{height} (Ratio {ratio:.1f})")
                                    return f"![{alt}](data:image/jpeg;base64,{target_b64})"
                            except Exception as e:
                                print(f"⚠️ Image Process Error: {e}")
                                return ""
                        
                        return "" # Remove if broken link or filtered

                    # Regex to find ![alt](ref)
                    page_md = re.sub(r'!\[(.*?)\]\((.*?)\)', replace_image_ref, page_md)

                    # --- B. Convert HTML Tables to Markdown (BeautifulSoup) ---
                    if "<table>" in page_md:
                        try:
                            from bs4 import BeautifulSoup
                            soup = BeautifulSoup(page_md, 'html.parser')
                            
                            for table in soup.find_all('table'):
                                rows = table.find_all('tr')
                                if not rows: continue
                                
                                # Process Rows
                                md_rows = []
                                headers = []
                                
                                # First Pass: Find headers or use first row
                                first_row_cells = rows[0].find_all(['th', 'td'])
                                headers = [c.get_text(strip=True) for c in first_row_cells]
                                
                                # Separator
                                separator = ["---"] * len(headers)
                                md_rows.append(f"| {' | '.join(headers)} |")
                                md_rows.append(f"| {' | '.join(separator)} |")
                                
                                # Other Rows
                                for row in rows[1:]:
                                    cells = row.find_all(['th', 'td'])
                                    row_data = [c.get_text(strip=True) for c in cells]
                                    while len(row_data) < len(headers): row_data.append("")
                                    md_rows.append(f"| {' | '.join(row_data)} |")
                                
                                # Replace HTML Table in Markdown
                                table_md = "\n".join(md_rows)
                                page_md = page_md.replace(str(table), f"\n{table_md}\n")

                        except Exception as e:
                            print(f"⚠️ HTML Table Convert Failed: {e}")
                            # Fallback to crude regex
                            page_md = page_md.replace("<table>", "").replace("</table>", "")
                            page_md = page_md.replace("<tr>", "\n").replace("</tr>", "")
                            page_md = page_md.replace("<td>", " | ").replace("</td>", "")

                    markdown_text += page_md + "\n\n"
            else:
                 print(f"⚠️ Unexpected JSON: {data.keys()}")
                 return str(data)

            elapsed = time.time() - start
            print(f"   🌪️ Mistral OCR: {len(markdown_text)} chars in {elapsed:.2f}s")
            return markdown_text.strip()

        except Exception as e:
            print(f"❌ Mistral OCR Error: {e}")
            return ""
