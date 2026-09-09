"""
Additive Schema Migration
SIH 2026 Problem ID: 26192 - Flash Flood Prediction System for Hilly Regions

`Base.metadata.create_all` creates missing TABLES but never alters an existing one, so a
database seeded before the shelter / evacuation work is missing the new columns. This
script closes that gap without dropping anything:

  * creates any missing table (currently `shelters`)
  * ALTERs in any missing column on `villages` and `alerts`

It is idempotent and non-destructive -- existing readings, risk history and alerts are
left untouched. Run it once after pulling the new models, then re-run the seeds:

    .venv\\Scripts\\python data\\migrate_schema.py
    .venv\\Scripts\\python data\\seed_villages.py
    .venv\\Scripts\\python data\\seed_shelters.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from backend.database import engine, Base
from backend import models  # noqa: F401 - registers all tables on Base.metadata

# table -> [(column_name, DDL type + default)]
ADDITIVE_COLUMNS = {
    "villages": [
        ("population", "INTEGER DEFAULT 0"),
        ("river_basin", "VARCHAR(100) DEFAULT ''"),
    ],
    "alerts": [
        ("dispatched_by", "VARCHAR(120) DEFAULT 'auto-threshold'"),
        ("cap_identifier", "VARCHAR(120)"),
    ],
}


async def _existing_columns(conn, table: str) -> set:
    """Column names currently present on `table`, via the SQLAlchemy inspector."""
    def _inspect(sync_conn):
        from sqlalchemy import inspect
        insp = inspect(sync_conn)
        if table not in insp.get_table_names():
            return None
        return {col["name"] for col in insp.get_columns(table)}
    return await conn.run_sync(_inspect)


async def migrate():
    print("Applying additive schema migration...")
    async with engine.begin() as conn:
        # 1. Create anything entirely missing (e.g. the shelters table).
        await conn.run_sync(Base.metadata.create_all)
        print("  tables ensured (create_all)")

        # 2. Add any missing columns to pre-existing tables.
        added = 0
        for table, columns in ADDITIVE_COLUMNS.items():
            present = await _existing_columns(conn, table)
            if present is None:
                print(f"  ! table '{table}' not found, skipping column checks")
                continue
            for name, ddl in columns:
                if name in present:
                    continue
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                print(f"  + {table}.{name} ({ddl})")
                added += 1

        if added == 0:
            print("  no columns to add -- schema already current")

    await engine.dispose()
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
