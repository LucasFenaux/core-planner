import sqlite3

def migrate():
    conn = sqlite3.connect("productivity.db")
    cursor = conn.cursor()
    
    # Create categories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Add category_ids to existing tables
    tables = ["tasks", "notes", "events"]
    for table in tables:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN category_ids TEXT DEFAULT '[]'")
            print(f"Added category_ids to {table}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column category_ids already exists in {table}")
            else:
                raise e
                
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
