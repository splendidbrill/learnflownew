from db import supabase

try:
    # Try to fetch one row to see columns
    res = supabase.table("profiles").select("*").limit(1).execute()
    if res.data:
        print("Columns in 'profiles' table:", res.data[0].keys())
    else:
        print("Profiles table is empty or could not be read.")
except Exception as e:
    print(f"Error checking profiles: {e}")
