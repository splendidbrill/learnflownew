from pypdf import PdfReader
import io

def parse_pdf_to_blocks(file_bytes: bytes):
    """
    Reads a PDF and returns a list of text blocks (paragraphs).
    """
    reader = PdfReader(io.BytesIO(file_bytes))
    blocks = []
    
    total_pages = len(reader.pages)
    block_sequence = 1

    print(f"📄 Parsing PDF with {total_pages} pages...")

    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if not text:
            continue
            
        # Simple splitting strategy: Double newline often means new paragraph
        paragraphs = text.split('\n\n')
        
        for para in paragraphs:
            clean_text = para.strip()
            # Ignore page numbers or tiny headers
            if len(clean_text) < 20: 
                continue
                
            blocks.append({
                "block_sequence": block_sequence,
                "content_type": "text",
                "original_content": clean_text,
                "page_number": i + 1
            })
            block_sequence += 1

    return blocks