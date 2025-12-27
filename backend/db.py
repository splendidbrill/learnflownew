import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY") # Use Service Role for backend ops

if not url or not key:
    raise ValueError("Supabase credentials missing!")

supabase: Client = create_client(url, key)