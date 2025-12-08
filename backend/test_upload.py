import requests

url = "http://localhost:8000/api/upload-book"
# REPLACE WITH YOUR REAL USER ID FROM SUPABASE -> AUTH -> USERS
user_id = "30e6cd0c-1503-427a-a002-dc960b849761" 

files = {'file': open('sample.pdf', 'rb')}
data = {'title': 'Physics 101', 'user_id': user_id}

print("⏳ Uploading PDF...")
try:
    response = requests.post(url, files=files, data=data)
    print(response.json())
except Exception as e:
    print("Error:", e)