import sqlite3
from contextlib import contextmanager
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime

# Database file location
DB_PATH = Path(__file__).parent.parent.parent / "tensorserve.db"

def get_db_path() -> Path:
    """Get the database file path."""
    return DB_PATH

@contextmanager
def get_db_connection():
    """
    Context manager for database connections.
    
    Ensures connections are properly closed after use.
    """
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row  # Enable dictionary-like access
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """
    Initialize the database with required tables.
    
    Creates the users table if it doesn't exist.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS benchmark_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_runs INTEGER NOT NULL,
                successful_runs INTEGER NOT NULL,
                failed_runs INTEGER NOT NULL,
                average_input_tokens REAL NOT NULL,
                average_output_tokens REAL NOT NULL,
                average_ttft REAL NOT NULL,
                average_generation_time REAL NOT NULL,
                average_tokens_per_second REAL NOT NULL,
                peak_ram_percent REAL NOT NULL,
                peak_ram_used_mb REAL NOT NULL,
                peak_gpu_utilization_percent REAL NOT NULL,
                peak_gpu_memory_used_mb REAL NOT NULL,
                peak_gpu_temperature_c REAL NOT NULL,
                peak_gpu_power_usage_w REAL NOT NULL,
                throughput_samples TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        conn.commit()

def create_user(email: str, hashed_password: str) -> int:
    """
    Create a new user in the database.
    
    Args:
        email: User's email address
        hashed_password: Bcrypt hash of the password
        
    Returns:
        The ID of the created user
        
    Raises:
        sqlite3.IntegrityError: If email already exists
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
            (email, hashed_password)
        )
        return cursor.lastrowid

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Get a user by email address.
    
    Args:
        email: User's email address
        
    Returns:
        User data as dictionary, or None if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM users WHERE email = ? AND is_active = 1",
            (email,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a user by ID.
    
    Args:
        user_id: User's ID
        
    Returns:
        User data as dictionary, or None if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM users WHERE id = ? AND is_active = 1",
            (user_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

def update_last_login(user_id: int):
    """
    Update the last login timestamp for a user.
    
    Args:
        user_id: User's ID
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            (user_id,)
        )


def create_benchmark_result(user_id: int, result: Dict[str, Any]) -> int:
    """Store a completed benchmark summary for the authenticated user."""
    import json

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO benchmark_results (
                user_id, total_runs, successful_runs, failed_runs,
                average_input_tokens, average_output_tokens,
                average_ttft, average_generation_time,
                average_tokens_per_second, peak_ram_percent,
                peak_ram_used_mb, peak_gpu_utilization_percent,
                peak_gpu_memory_used_mb, peak_gpu_temperature_c,
                peak_gpu_power_usage_w, throughput_samples
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                result["total_runs"],
                result["successful_runs"],
                result["failed_runs"],
                result["average_input_tokens"],
                result["average_output_tokens"],
                result["average_ttft"],
                result["average_generation_time"],
                result["average_tokens_per_second"],
                result["peak_ram_percent"],
                result["peak_ram_used_mb"],
                result["peak_gpu_utilization_percent"],
                result["peak_gpu_memory_used_mb"],
                result["peak_gpu_temperature_c"],
                result["peak_gpu_power_usage_w"],
                json.dumps(result.get("throughput_samples", [])),
            ),
        )
        return cursor.lastrowid


def _normalize_throughput_samples(samples: Any) -> list[Dict[str, float]]:
    """Accept timed samples, and coerce legacy float arrays for history."""
    if not isinstance(samples, list):
        return []

    normalized: list[Dict[str, float]] = []
    elapsed_time = 0.0

    for index, sample in enumerate(samples):
        if isinstance(sample, (int, float)):
            elapsed_time += 1.0
            normalized.append({
                "time": elapsed_time,
                "throughput": float(sample),
            })
            continue

        if isinstance(sample, dict) and "throughput" in sample:
            time_value = sample.get("time", index + 1)
            normalized.append({
                "time": float(time_value),
                "throughput": float(sample["throughput"]),
            })

    return normalized


def get_benchmark_results(user_id: int) -> list[Dict[str, Any]]:
    """Return benchmark summaries belonging only to the requested user."""
    import json

    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM benchmark_results
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            """,
            (user_id,),
        ).fetchall()

    results = []
    for row in rows:
        result = dict(row)
        result.pop("user_id", None)
        result["throughput_samples"] = _normalize_throughput_samples(
            json.loads(result["throughput_samples"])
        )
        results.append(result)
    return results
