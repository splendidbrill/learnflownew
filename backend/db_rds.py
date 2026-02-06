"""
AWS RDS Database Connection for Telemetry/Misconception Data

This is a SEPARATE database from Supabase.
Used for proprietary learning analytics that gives us our competitive moat.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

# RDS Configuration from environment variables
RDS_HOST = os.getenv("RDS_HOST", "learnflow-telemetry.cexgym8wejb5.us-east-1.rds.amazonaws.com")
RDS_PORT = os.getenv("RDS_PORT", "5432")
RDS_DATABASE = os.getenv("RDS_DATABASE", "postgres")
RDS_USER = os.getenv("RDS_USER", "postgres")
RDS_PASSWORD = os.getenv("RDS_PASSWORD", "")


def get_rds_connection():
    """Create a connection to the AWS RDS PostgreSQL database."""
    if not RDS_PASSWORD:
        raise ValueError("RDS_PASSWORD environment variable not set")
    
    return psycopg2.connect(
        host=RDS_HOST,
        port=RDS_PORT,
        database=RDS_DATABASE,
        user=RDS_USER,
        password=RDS_PASSWORD,
        cursor_factory=RealDictCursor
    )


@contextmanager
def rds_cursor():
    """Context manager for RDS database operations."""
    conn = get_rds_connection()
    try:
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def init_rds_tables():
    """Initialize the misconception tables if they don't exist."""
    with rds_cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS misconception_logs (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                paragraph_id TEXT,
                concept TEXT,
                failed_analogy TEXT,
                user_interest TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS successful_analogies (
                id SERIAL PRIMARY KEY,
                concept TEXT NOT NULL,
                user_interest TEXT NOT NULL,
                analogy_text TEXT,
                success_count INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(concept, user_interest)
            );
            
            CREATE INDEX IF NOT EXISTS idx_successful_concept 
                ON successful_analogies(concept, user_interest);
        """)
    print("✅ RDS Misconception tables initialized")


# Try to initialize on import (will fail gracefully if no connection)
try:
    init_rds_tables()
except Exception as e:
    print(f"⚠️ RDS init skipped (will retry on first request): {e}")
