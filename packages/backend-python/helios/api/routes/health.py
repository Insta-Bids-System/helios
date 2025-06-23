"""Health check endpoints."""

from fastapi import APIRouter
from helios.db.connection import db_pool
from helios.utils.logger import helios_logger as logger

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": "helios-backend",
        "version": "1.0.0"
    }


@router.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check including dependencies."""
    health_status = {
        "status": "healthy",
        "service": "helios-backend",
        "version": "1.0.0",
        "dependencies": {
            "database": "unknown",
            "redis": "unknown"
        }
    }
    
    # Check database
    try:
        await db_pool.execute("SELECT 1")
        health_status["dependencies"]["database"] = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        health_status["dependencies"]["database"] = "unhealthy"
        health_status["status"] = "degraded"
    
    # Redis check would go here
    
    return health_status
