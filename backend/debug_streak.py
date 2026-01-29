from db import supabase
import sys
import pprint

user_id = "30e6cd0c-1503-427a-a002-dc960b849761"

print(f"Checking profile for {user_id}...")
try:
    res = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    pprint.pprint(res.data)
except Exception as e:
    print(f"Error: {e}")
