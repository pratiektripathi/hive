from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routers import user, token, apikey, templates, imports
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from image_storage import ensure_image_dir, IMAGE_DIR
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

ensure_image_dir()
app.mount("/images", StaticFiles(directory=str(IMAGE_DIR)), name="images")

app.include_router(user.router, prefix="/api")
app.include_router(user.signup_router, prefix="/api")
app.include_router(token.router, prefix="/api")
app.include_router(token.logout_router, prefix="/api")
app.include_router(apikey.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(imports.router, prefix="/api")