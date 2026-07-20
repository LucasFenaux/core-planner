import sqlite3
import os
import sys
import shutil

# Determine the appropriate directory for data based on how the app is run
if getattr(sys, "frozen", False):
    app_dir = os.path.dirname(sys.executable)
else:
    app_dir = os.path.abspath(os.getcwd())  # use current working dir for standard script execution

default_data_dir = os.path.join(app_dir, "data")
APP_DATA_DIR = os.environ.get("APP_DATA_DIR", default_data_dir)
DB_FILE = os.path.join(APP_DATA_DIR, "productivity.db")

if not os.path.exists(APP_DATA_DIR):
    os.makedirs(APP_DATA_DIR, exist_ok=True)


def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Create Categories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create Tasks table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'medium',
            deadline TIMESTAMP,
            category_ids TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create Notes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT,
            category_ids TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create Events table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            notes TEXT,
            category_ids TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create Daily Logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_logs (
            date TEXT PRIMARY KEY,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Migrations
    try:
        cursor.execute("ALTER TABLE tasks ADD COLUMN recurrence TEXT DEFAULT 'none'")
    except sqlite3.OperationalError:
        pass  # column already exists

    conn.commit()

    # Auto-migration: if the DB we just initialised is empty, try to copy
    # data from the canonical project data directory.
    cursor.execute("SELECT count(*) FROM tasks")
    task_count = cursor.fetchone()[0]
    conn.close()

    if task_count == 0:
        # Look for the project-level data directory relative to this file's location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(script_dir, "data", "productivity.db"),         # backend/data/
            os.path.join(script_dir, "..", "data", "productivity.db"),    # project root /data/
        ]
        for candidate in candidates:
            candidate = os.path.normpath(candidate)
            if os.path.exists(candidate) and os.path.abspath(candidate) != os.path.abspath(DB_FILE):
                print(f"[database] Auto-migrating from {candidate} → {DB_FILE}")
                shutil.copy2(candidate, DB_FILE)
                break


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


init_db()
