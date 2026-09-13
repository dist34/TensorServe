from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class User:
    """User model representing a user in the system."""
    id: int
    email: str
    hashed_password: str
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool = True

@dataclass
class UserCreate:
    """Schema for creating a new user."""
    email: str
    password: str

@dataclass
class UserInDB:
    """User as stored in database (with hashed password)."""
    id: int
    email: str
    hashed_password: str
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool = True

@dataclass
class UserResponse:
    """User response schema (without sensitive data)."""
    id: int
    email: str
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool = True

def user_row_to_model(row) -> User:
    """Convert a database row to User model."""
    created_at = row["created_at"]
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace('T', ' ').replace('Z', ''))
        except ValueError:
            created_at = datetime.now()
    
    last_login = row.get("last_login")
    if last_login:
        if isinstance(last_login, str):
            try:
                last_login = datetime.fromisoformat(last_login.replace('T', ' ').replace('Z', ''))
            except ValueError:
                last_login = None
    
    return User(
        id=row["id"],
        email=row["email"],
        hashed_password=row["hashed_password"],
        created_at=created_at,
        last_login=last_login,
        is_active=bool(row["is_active"])
    )

def user_row_to_response(row) -> UserResponse:
    """Convert a database row to UserResponse (without password)."""
    created_at = row["created_at"]
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace('T', ' ').replace('Z', ''))
        except ValueError:
            created_at = datetime.now()
    
    last_login = row.get("last_login")
    if last_login:
        if isinstance(last_login, str):
            try:
                last_login = datetime.fromisoformat(last_login.replace('T', ' ').replace('Z', ''))
            except ValueError:
                last_login = None
    
    return UserResponse(
        id=row["id"],
        email=row["email"],
        created_at=created_at,
        last_login=last_login,
        is_active=bool(row["is_active"])
    )