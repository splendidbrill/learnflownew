import requests

url = "http://localhost:8000/api/explain"

payload = {
    "text": "Newton's first law states that an object will remain at rest or in uniform motion unless acted upon by an external force.",
    "interests": ["football"],
    "book_type": "physics"
}

print("⏳ Sending request to AI...")
response = requests.post(url, json=payload)
print("✅ Response:", response.json())