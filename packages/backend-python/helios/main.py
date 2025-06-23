"""Main FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from helios.config.settings import settings
from helios.utils.logger import helios_logger as logger
from helios.db.connection import db_pool
from helios.api.routes import projects, health
import redis.asyncio as redis


# Create Socket.IO server
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode="asgi"
)

# Global Redis client
redis_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global redis_client
    
    # Startup
    logger.info("Starting Helios Backend...")
    
    # Initialize database pool
    await db_pool.initialize()
    
    # Initialize Redis
    redis_client = redis.from_url(settings.redis_url)
    await redis_client.ping()
    logger.info("Redis connection established")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Helios Backend...")
    await db_pool.close()
    await redis_client.close()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO app
socket_app = socketio.ASGIApp(sio, app)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])


# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    logger.info(f"Client connected: {sid}")
    await sio.emit("connection_established", {"status": "connected"}, room=sid)


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"Client disconnected: {sid}")


@sio.event
async def join_project(sid, data):
    """Join a project-specific room for real-time updates."""
    project_id = data.get("project_id")
    if project_id:
        await sio.enter_room(sid, f"project_{project_id}")
        logger.info(f"Client {sid} joined project room: {project_id}")
        await sio.emit("joined_project", {"project_id": project_id}, room=sid)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "helios.main:socket_app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
