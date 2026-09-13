from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.auth.security import verify_token
from app.auth.database import get_user_by_id
from app.auth.models import user_row_to_model

# HTTP Bearer token scheme
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    FastAPI dependency to get the current authenticated user.
    
    This extracts the Bearer token from the Authorization header,
    validates it, and returns the user object.
    
    Usage:
        @app.get("/protected")
        async def protected_route(current_user = Depends(get_current_user)):
            return {"user": current_user.email}
    """
    try:
        # Extract token from Authorization header
        token = credentials.credentials
        
        # Verify token and get payload
        payload = verify_token(token)
        
        # Get user ID from token
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        user_id = int(user_id_str)
        
        # Get user from database
        user_data = get_user_by_id(user_id)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Convert to User model
        return user_row_to_model(user_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
):
    """
    FastAPI dependency to get the current user if authenticated.
    
    This is similar to get_current_user but doesn't raise an error
    if no token is provided. Returns None if not authenticated.
    
    Usage:
        @app.get("/public")
        async def public_route(current_user = Depends(get_optional_user)):
            if current_user:
                return {"user": current_user.email}
            return {"message": "Hello anonymous user"}
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        payload = verify_token(token)
        
        user_id_str = payload.get("sub")
        if user_id_str is None:
            return None
        
        user_id = int(user_id_str)
        user_data = get_user_by_id(user_id)
        
        if not user_data:
            return None
        
        return user_row_to_model(user_data)
        
    except Exception:
        return None