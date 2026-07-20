import uuid
import json
import sys
import os
import shutil
import threading
import time
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime, timedelta
import calendar
import database


# ---------------------------------------------------------------------------
# Backup helpers
# ---------------------------------------------------------------------------
MAX_BACKUPS = 30          # keep at most this many timestamped backups
BACKUP_INTERVAL_HOURS = 24  # how often the background thread runs


def _do_backup(label: str = "") -> str:
    """Copy the live DB to the backups folder and return the filename.
    Prunes old backups so at most MAX_BACKUPS are kept.
    """
    db_path = database.DB_FILE
    backup_dir = os.path.join(database.APP_DATA_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = f"_{label}" if label else ""
    filename = f"productivity_backup_{timestamp}{suffix}.db"
    dest = os.path.join(backup_dir, filename)

    shutil.copy2(db_path, dest)
    print(f"[backup] Created {filename}")

    # Prune: keep only the MAX_BACKUPS most-recent files
    backups = sorted(
        [f for f in os.listdir(backup_dir) if f.endswith(".db")],
        reverse=True,
    )
    for old in backups[MAX_BACKUPS:]:
        try:
            os.remove(os.path.join(backup_dir, old))
            print(f"[backup] Pruned old backup: {old}")
        except OSError:
            pass

    return filename


def _auto_backup_loop():
    """Background thread: sleep BACKUP_INTERVAL_HOURS, then back up, repeat."""
    while True:
        time.sleep(BACKUP_INTERVAL_HOURS * 3600)
        try:
            _do_backup(label="auto")
        except Exception as exc:
            print(f"[backup] Auto-backup failed: {exc}")


def start_auto_backup():
    """Perform an on-startup backup, then launch the periodic background thread."""
    try:
        _do_backup(label="startup")
    except Exception as exc:
        print(f"[backup] Startup backup failed: {exc}")

    t = threading.Thread(target=_auto_backup_loop, daemon=True, name="auto-backup")
    t.start()


# Initialize the DB tables if they don't exist
database.init_db()

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app_instance):
    # On startup: take a backup and launch the daily backup thread
    start_auto_backup()
    yield
    # Shutdown: nothing special needed (daemon thread dies with process)

app = FastAPI(title="Productivity App API", lifespan=lifespan)

api_router = APIRouter()

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Since it's a local app, we can allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Models ---

class CategoryBase(BaseModel):
    name: str
    color: str

class Category(CategoryBase):
    id: str
    created_at: str
    updated_at: str

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    deadline: Optional[str] = None # ISO format string
    category_ids: List[str] = []
    recurrence: Optional[str] = "none"

class Task(TaskBase):
    id: str
    created_at: str
    updated_at: str

class NoteBase(BaseModel):
    title: str
    content: Optional[str] = ""
    category_ids: List[str] = []

class Note(NoteBase):
    id: str
    created_at: str
    updated_at: str

class EventBase(BaseModel):
    title: str
    start_time: str # ISO format string
    end_time: str # ISO format string
    notes: Optional[str] = None
    category_ids: List[str] = []

class Event(EventBase):
    id: str
    created_at: str
    updated_at: str

class DailyLogBase(BaseModel):
    content: Optional[str] = ""

class DailyLog(DailyLogBase):
    date: str
    created_at: str
    updated_at: str

class DashboardStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    tasks_by_status: List[Dict[str, Any]]
    tasks_by_category: List[Dict[str, Any]]
    upcoming_events: List[Event]
    recent_notes: List[Note]

# Helper to parse DB rows
def parse_row(row):
    d = dict(row)
    if 'category_ids' in d:
        try:
            d['category_ids'] = json.loads(d['category_ids'])
        except Exception:
            d['category_ids'] = []
    return d

# --- Routes for Categories ---
@api_router.get("/categories", response_model=List[Category])
def get_categories():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories ORDER BY name ASC")
    categories = cursor.fetchall()
    conn.close()
    return [dict(c) for c in categories]

@api_router.post("/categories", response_model=Category)
def create_category(category: CategoryBase):
    cat_id = str(uuid.uuid4())
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO categories (id, name, color) VALUES (?, ?, ?)",
        (cat_id, category.name, category.color)
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM categories WHERE id = ?", (cat_id,))
    new_cat = cursor.fetchone()
    conn.close()
    return dict(new_cat)

@api_router.put("/categories/{cat_id}", response_model=Category)
def update_category(cat_id: str, category: CategoryBase):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE categories SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (category.name, category.color, cat_id)
    )
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found")
    conn.commit()
    
    cursor.execute("SELECT * FROM categories WHERE id = ?", (cat_id,))
    updated_cat = cursor.fetchone()
    conn.close()
    return dict(updated_cat)

@api_router.delete("/categories/{cat_id}")
def delete_category(cat_id: str):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found")
    conn.commit()
    conn.close()
    return {"message": "Category deleted"}


# --- Routes for Dashboard ---
@api_router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # 1. Total tasks & completed tasks
    cursor.execute("SELECT count(*) as count FROM tasks")
    total_tasks = cursor.fetchone()["count"]
    cursor.execute("SELECT count(*) as count FROM tasks WHERE status = 'done'")
    completed_tasks = cursor.fetchone()["count"]
    
    # 2. Tasks by status
    cursor.execute("SELECT status, count(*) as count FROM tasks GROUP BY status")
    tasks_by_status = [dict(r) for r in cursor.fetchall()]
    
    # 3. Tasks by category (we need to parse JSON arrays, so we can do it in python)
    cursor.execute("SELECT category_ids FROM tasks")
    all_cat_ids = cursor.fetchall()
    cat_counts = {}
    for r in all_cat_ids:
        try:
            ids = json.loads(r["category_ids"])
            for cid in ids:
                cat_counts[cid] = cat_counts.get(cid, 0) + 1
        except Exception:
            pass
            
    # Resolve category names
    tasks_by_category = []
    if cat_counts:
        cursor.execute("SELECT id, name, color FROM categories")
        categories = {c["id"]: dict(c) for c in cursor.fetchall()}
        for cid, count in cat_counts.items():
            if cid in categories:
                tasks_by_category.append({
                    "name": categories[cid]["name"],
                    "color": categories[cid]["color"],
                    "count": count
                })
    
    # 4. Upcoming events
    # We fetch events where start_time > now (simple string compare works for ISO formats)
    now_str = datetime.utcnow().isoformat()
    cursor.execute("SELECT * FROM events WHERE start_time >= ? ORDER BY start_time ASC LIMIT 5", (now_str,))
    upcoming_events = [parse_row(r) for r in cursor.fetchall()]
    
    # 5. Recent notes
    cursor.execute("SELECT * FROM notes ORDER BY updated_at DESC LIMIT 5")
    recent_notes = [parse_row(r) for r in cursor.fetchall()]
    
    conn.close()
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "tasks_by_status": tasks_by_status,
        "tasks_by_category": tasks_by_category,
        "upcoming_events": upcoming_events,
        "recent_notes": recent_notes
    }


# --- Routes for Tasks ---
@api_router.get("/tasks", response_model=List[Task])
def get_tasks():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    tasks = cursor.fetchall()
    conn.close()
    return [parse_row(t) for t in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    task = cursor.fetchone()
    conn.close()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return parse_row(task)

@api_router.post("/tasks", response_model=Task)
def create_task(task: TaskBase):
    task_id = str(uuid.uuid4())
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO tasks (id, title, description, status, priority, deadline, category_ids, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (task_id, task.title, task.description, task.status, task.priority, task.deadline, json.dumps(task.category_ids), task.recurrence)
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    new_task = cursor.fetchone()
    conn.close()
    return parse_row(new_task)

@api_router.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, task: TaskBase):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # Check old task for recurrence logic
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    old_task = cursor.fetchone()
    if not old_task:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
        
    cursor.execute(
        "UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, deadline = ?, category_ids = ?, recurrence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (task.title, task.description, task.status, task.priority, task.deadline, json.dumps(task.category_ids), task.recurrence, task_id)
    )
    
    # Recurrence clone logic
    if task.status == 'done' and old_task['status'] != 'done' and task.recurrence and task.recurrence != 'none':
        new_id = str(uuid.uuid4())
        new_deadline = None
        if task.deadline:
            try:
                has_time = 'T' in task.deadline
                dt_str = task.deadline.replace('Z', '+00:00')
                if not has_time:
                    dt_str += 'T00:00:00+00:00'
                dt = datetime.fromisoformat(dt_str)
                
                if task.recurrence == 'daily':
                    dt = dt + timedelta(days=1)
                elif task.recurrence == 'weekly':
                    dt = dt + timedelta(days=7)
                elif task.recurrence == 'biweekly':
                    dt = dt + timedelta(days=14)
                elif task.recurrence == 'monthly':
                    month = dt.month - 1 + 1
                    year = dt.year + month // 12
                    month = month % 12 + 1
                    day = min(dt.day, calendar.monthrange(year, month)[1])
                    dt = dt.replace(year=year, month=month, day=day)
                elif task.recurrence == 'yearly':
                    dt = dt.replace(year=dt.year + 1)
                
                if has_time:
                    new_deadline = dt.isoformat()
                    if new_deadline.endswith('+00:00'):
                        new_deadline = new_deadline[:-6] + 'Z'
                else:
                    new_deadline = dt.strftime('%Y-%m-%d')
            except Exception as e:
                print(f"Error calculating next deadline: {e}")
                new_deadline = task.deadline # fallback
        
        cursor.execute(
            "INSERT INTO tasks (id, title, description, status, priority, deadline, category_ids, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (new_id, task.title, task.description, 'todo', task.priority, new_deadline, json.dumps(task.category_ids), task.recurrence)
        )

    conn.commit()
    
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated_task = cursor.fetchone()
    conn.close()
    return parse_row(updated_task)

@api_router.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
    conn.commit()
    conn.close()
    return {"message": "Task deleted"}


# --- Routes for Notes ---
@api_router.get("/notes", response_model=List[Note])
def get_notes():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notes ORDER BY updated_at DESC")
    notes = cursor.fetchall()
    conn.close()
    return [parse_row(n) for n in notes]

@api_router.post("/notes", response_model=Note)
def create_note(note: NoteBase):
    note_id = str(uuid.uuid4())
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO notes (id, title, content, category_ids) VALUES (?, ?, ?, ?)",
        (note_id, note.title, note.content, json.dumps(note.category_ids))
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    new_note = cursor.fetchone()
    conn.close()
    return parse_row(new_note)

@api_router.put("/notes/{note_id}", response_model=Note)
def update_note(note_id: str, note: NoteBase):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE notes SET title = ?, content = ?, category_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (note.title, note.content, json.dumps(note.category_ids), note_id)
    )
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    conn.commit()
    
    cursor.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
    updated_note = cursor.fetchone()
    conn.close()
    return parse_row(updated_note)

@api_router.delete("/notes/{note_id}")
def delete_note(note_id: str):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    conn.commit()
    conn.close()
    return {"message": "Note deleted"}


# --- Routes for Events ---
@api_router.get("/events", response_model=List[Event])
def get_events():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events ORDER BY start_time ASC")
    events = cursor.fetchall()
    conn.close()
    return [parse_row(e) for e in events]

@api_router.get("/events/{event_id}", response_model=Event)
def get_event(event_id: str):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    conn.close()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return parse_row(event)

@api_router.post("/events", response_model=Event)
def create_event(event: EventBase):
    event_id = str(uuid.uuid4())
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO events (id, title, start_time, end_time, notes, category_ids) VALUES (?, ?, ?, ?, ?, ?)",
        (event_id, event.title, event.start_time, event.end_time, event.notes, json.dumps(event.category_ids))
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    new_event = cursor.fetchone()
    conn.close()
    return parse_row(new_event)

@api_router.put("/events/{event_id}", response_model=Event)
def update_event(event_id: str, event: EventBase):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE events SET title = ?, start_time = ?, end_time = ?, notes = ?, category_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (event.title, event.start_time, event.end_time, event.notes, json.dumps(event.category_ids), event_id)
    )
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Event not found")
    conn.commit()
    
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    updated_event = cursor.fetchone()
    conn.close()
    return parse_row(updated_event)

@api_router.delete("/events/{event_id}")
def delete_event(event_id: str):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Event not found")
    conn.commit()
    conn.close()
    return {"status": "success"}


# --- Manual backup endpoint ---
@api_router.post("/backup")
def backup_database():
    if not os.path.exists(database.DB_FILE):
        raise HTTPException(status_code=404, detail="Database file not found")
    try:
        filename = _do_backup(label="manual")
        backup_dir = os.path.join(database.APP_DATA_DIR, "backups")
        backups = sorted(
            [f for f in os.listdir(backup_dir) if f.endswith(".db")],
            reverse=True,
        )
        return {
            "status": "success",
            "message": f"Backed up to backups/{filename}",
            "filename": filename,
            "total_backups": len(backups),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@api_router.get("/backups")
def list_backups():
    """Return a list of all backup files, newest first."""
    backup_dir = os.path.join(database.APP_DATA_DIR, "backups")
    if not os.path.exists(backup_dir):
        return []
    backups = sorted(
        [f for f in os.listdir(backup_dir) if f.endswith(".db")],
        reverse=True,
    )
    result = []
    for f in backups:
        path = os.path.join(backup_dir, f)
        stat = os.stat(path)
        result.append({
            "filename": f,
            "size_kb": round(stat.st_size / 1024, 1),
            "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        })
    return result


# --- Routes for Daily Logs ---

@api_router.get("/daily-logs", response_model=List[DailyLog])
def get_all_daily_logs():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM daily_logs ORDER BY date DESC")
    logs = cursor.fetchall()
    conn.close()
    return [parse_row(log) for log in logs]

@api_router.get("/daily-logs/{log_date}", response_model=DailyLog)
def get_daily_log(log_date: str):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM daily_logs WHERE date = ?", (log_date,))
    log = cursor.fetchone()
    conn.close()
    if not log:
        return {"date": log_date, "content": "", "created_at": "", "updated_at": ""}
    return parse_row(log)

@api_router.put("/daily-logs/{log_date}", response_model=DailyLog)
def update_daily_log(log_date: str, log: DailyLogBase):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM daily_logs WHERE date = ?", (log_date,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute(
            "UPDATE daily_logs SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?",
            (log.content, log_date)
        )
    else:
        cursor.execute(
            "INSERT INTO daily_logs (date, content) VALUES (?, ?)",
            (log_date, log.content)
        )
        
    conn.commit()
    
    cursor.execute("SELECT * FROM daily_logs WHERE date = ?", (log_date,))
    updated_log = cursor.fetchone()
    conn.close()
    return parse_row(updated_log)

app.include_router(api_router, prefix="/api")

if getattr(sys, "frozen", False):
    base_dir = sys._MEIPASS
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

static_dir = os.path.join(base_dir, "static")

if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

@app.exception_handler(404)
async def custom_404_handler(request, __):
    if request.url.path.startswith("/api/"):
        return json.dumps({"detail": "Not found"}), 404
    # SPA fallback
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return "Frontend not built.", 404

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    # Pass the 'app' instance directly instead of string "main:app" for PyInstaller compatibility
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
