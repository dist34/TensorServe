from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta
from dataclasses import asdict
from app.auth.security import (
    hash_password, 
    verify_password, 
    create_access_token, 
    verify_token
)
from app.auth.database import (
    init_db, 
    create_user, 
    get_user_by_email, 
    get_user_by_id, 
    update_last_login
)
from app.auth.models import user_row_to_response
from app.schemas.auth import UserCreate, UserLogin, Token, UserResponse

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """
    Register a new user.
    
    Creates a new user account and returns an access token.
    """
    # Check if user already exists
    existing_user = get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash the password
    hashed_password = hash_password(user_data.password)
    
    # Create user in database
    user_id = create_user(user_data.email, hashed_password)
    
    # Get the created user
    user_data_db = get_user_by_id(user_id)
    if not user_data_db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user_id), "email": user_data.email}
    )
    
    # Update last login
    update_last_login(user_id)
    
    # Return token and user info (convert dataclass to dict for Pydantic validation)
    user_response = user_row_to_response(user_data_db)
    return Token(
        access_token=access_token,
        user=asdict(user_response)
    )

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    """
    Authenticate a user and return an access token.
    """
    # Get user by email
    user = get_user_by_email(user_data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user["id"]), "email": user["email"]},
        expires_delta=timedelta(minutes=30)
    )
    
    # Update last login
    update_last_login(user["id"])
    
    # Return token and user info (convert dataclass to dict for Pydantic validation)
    user_response = user_row_to_response(user)
    return Token(
        access_token=access_token,
        user=asdict(user_response)
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    """
    Get the current authenticated user.
    
    This endpoint validates the token and returns user information.
    """
    try:
        token = credentials.credentials
        payload = verify_token(token)
        
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        user_id = int(user_id_str)
        user_data = get_user_by_id(user_id)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Convert dataclass to dict for Pydantic validation
        user_response = user_row_to_response(user_data)
        return asdict(user_response)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )