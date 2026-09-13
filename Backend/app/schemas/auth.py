from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr

class UserCreate(UserBase):
    """Schema for user registration."""
    password: str = Field(..., min_length=6, max_length=100)

class UserLogin(UserBase):
    """Schema for user login."""
    password: str

class UserResponse(BaseModel):
    """Schema for user response (without sensitive data)."""
    id: int
    email: EmailStr
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool = True

class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    """Schema for token payload data."""
    user_id: Optional[int] = None
    email: Optional[str] = None