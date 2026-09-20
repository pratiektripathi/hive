import jwt
from dotenv import load_dotenv
import os
from datetime import timedelta, datetime, timezone


load_dotenv()

# Use SECRET_KEY instead of SECURITY_KEY, and provide a default algorithm
SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("SECURITY_KEY") or "your-secret-key-here-change-in-production"
ALGORITHM = os.getenv("ALGORITHM", "HS256")


def create_access_token(data:dict,expires_delta: timedelta | None = None ):
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=30)

    to_encode.update({"exp" : expire, "type": "access"})
        
    encoded_jwt = jwt.encode(to_encode,SECRET_KEY,ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=30)
    
    to_encode.update({"exp": expire, "type": "refresh"})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, ALGORITHM)
    return encoded_jwt

def decode_access_token(token:str):
    payload = jwt.decode(token,SECRET_KEY,ALGORITHM)
    return payload

