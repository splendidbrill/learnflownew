import requests
from fpdf import FPDF
import io

# --- CONFIGURATION ---
BASE_URL = "http://localhost:8000"
USER_ID = "30e6cd0c-1503-427a-a002-dc960b849761"  # <--- PASTE SUPABASE USER ID HERE

def create_dummy_pdf():
    """Generates a valid PDF file in memory for testing."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    
    # Paragraph 1
    pdf.cell(200, 10, txt="Chapter 1: The Basics of Motion", ln=1, align='C')
    pdf.multi_cell(0, 10, txt="Newton's First Law states that an object remains at rest or in uniform motion unless acted upon by a force. This is often called the law of inertia.")
    
    pdf.ln(10) # Empty line
    
    # Paragraph 2
    pdf.multi_cell(0, 10, txt="For example, a soccer ball sitting on the grass will not move until you kick it. Once kicked, it will keep rolling until friction or a net stops it.")
    
    # Return as bytes
    return pdf.output(dest='S').encode('latin-1')

def test_upload():
    print(f"🚀 Generating test PDF...")
    pdf_bytes = create_dummy_pdf()
    
    # Prepare the upload
    files = {
        'file': ('test_physics.pdf', pdf_bytes, 'application/pdf')
    }
    data = {
        'title': 'Test Physics Book',
        'user_id': USER_ID
    }

    print(f"📤 Uploading to {BASE_URL}/api/upload-book...")
    try:
        response = requests.post(f"{BASE_URL}/api/upload-book", files=files, data=data)
        
        if response.status_code == 200:
            print("\n✅ SUCCESS! Server responded:")
            print(response.json())
            print("\nNext Step: Check your Supabase 'content_blocks' table!")
        else:
            print(f"\n❌ FAILED. Status: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"\n❌ CONNECTION ERROR: {e}")
        print("Is the backend running?")

if __name__ == "__main__":
    # You need to install fpdf just for this test script
    # pip install fpdf
    test_upload()