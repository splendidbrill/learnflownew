import os

print("--- FILE DIAGNOSTIC ---")
files = os.listdir('.')
print(f"Files in current folder: {files}")

print("\n--- CHECKING FOR .ENV ---")
if '.env' in files:
    print("✅ Found a file named exactly '.env'")
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            content = f.read()
            print(f"📄 File Content Length: {len(content)} characters")
            print(f"📄 First 50 chars: {content[:50]}")
    except Exception as e:
        print(f"❌ Could not read .env: {e}")
elif '.env.txt' in files:
    print("❌ FOUND '.env.txt'! Rename this to just '.env'")
else:
    print("❌ No .env file found. Do you see a file named 'env' without the dot?")