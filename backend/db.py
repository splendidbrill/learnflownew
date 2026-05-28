import os
import asyncpg
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# --- Supabase (Auth only) ---
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key) if url and key else None

# --- RDS PostgreSQL (All data) ---
RDS_HOST = os.environ.get("RDS_HOST")
RDS_PORT = int(os.environ.get("RDS_PORT", 5432))
RDS_DB = os.environ.get("RDS_DB", "learnflow")
RDS_USER = os.environ.get("RDS_USER", "postgres")
RDS_PASSWORD = os.environ.get("RDS_PASSWORD")

_pool = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=RDS_HOST,
            port=RDS_PORT,
            database=RDS_DB,
            user=RDS_USER,
            password=RDS_PASSWORD,
            ssl="require",
            min_size=2,
            max_size=10,
        )
    return _pool

async def get_db() -> asyncpg.Connection:
    pool = await get_pool()
    return pool
