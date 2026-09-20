from fastapi import FastAPI
from routers import user, token, apikey
from database import create_db
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8094",
    "https://hive.100xseller.com",
]

production_domain = os.getenv("FRONTEND_URL", "https://hive.100xseller.com")
if production_domain and production_domain not in origins:
    origins.append(production_domain)

app=FastAPI(
    title="Hive API",
    version="1.2.0",
    description="Hive API"
)

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    await create_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Set-Cookie"],
)

@app.get("/")
def root():
    return {"details": "Welcome to Hive API"}

@app.get("/health")
def health():
    return {"ok": True}

app.include_router(user.router, prefix="/api")
app.include_router(token.router, prefix="/api")
app.include_router(token.logout_router, prefix="/api")
app.include_router(apikey.router, prefix="/api")