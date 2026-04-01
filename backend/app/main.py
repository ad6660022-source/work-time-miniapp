import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database.connection import create_pool
from app.database.init_db import init_database
from app.scheduler import setup_scheduler
from app.routers import auth, shifts, tasks, users, reports, attendance, announcements

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

STATIC_DIR = Path(os.getenv("STATIC_DIR", str(Path(__file__).parent.parent / "frontend" / "dist")))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DB
    pool = await create_pool(settings.DATABASE_URL)
    await init_database(pool)
    app.state.pool = pool

    # Scheduler
    scheduler = setup_scheduler(pool)
    scheduler.start()

    # Bot (background task)
    from app.bot import run_bot
    bot_task = asyncio.create_task(run_bot(pool))

    logger.info("✅ App started")
    yield

    bot_task.cancel()
    try:
        await bot_task
    except asyncio.CancelledError:
        pass
    scheduler.shutdown()
    await pool.close()
    logger.info("App shutdown")


app = FastAPI(title="Work Time API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inject pool into dependency overrides
async def get_pool():
    return app.state.pool

from app import auth as auth_module
app.dependency_overrides[auth_module.get_db_user.__wrapped__ if hasattr(auth_module.get_db_user, '__wrapped__') else auth_module.get_db_user] = get_pool

# Routers
app.include_router(auth.router)
app.include_router(shifts.router)
app.include_router(tasks.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(attendance.router)
app.include_router(announcements.router)


# ── Serve React frontend ──────────────────────────────────────────────────────

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = STATIC_DIR / "index.html"
        return FileResponse(str(index))
else:
    @app.get("/")
    async def root():
        return {"status": "API running. Frontend not built yet."}
