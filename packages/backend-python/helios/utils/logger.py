"""Logging configuration using loguru."""

import sys
from loguru import logger
from helios.config.settings import settings


def setup_logger():
    """Configure loguru logger for the Helios system."""
    # Remove default logger
    logger.remove()
    
    # Console logging with color
    logger.add(
        sys.stdout,
        level=settings.log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        colorize=True,
    )
    
    # File logging for production
    if not settings.debug:
        logger.add(
            "logs/helios_{time}.log",
            rotation="500 MB",
            retention="10 days",
            level=settings.log_level,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        )
    
    return logger


# Initialize logger
helios_logger = setup_logger()
