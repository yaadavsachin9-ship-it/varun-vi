import asyncio
import os
import sys

# Ensure root directory is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import engine, Base
from backend.models import Village, Reading, RiskScore, Alert

async def run_migrations():
    print("Initiating database migration...")
    async with engine.begin() as conn:
        print("Creating all tables if not present...")
        await conn.run_sync(Base.metadata.create_all)
    print("Database migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(run_migrations())
