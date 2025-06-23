"""Database connection and session management using asyncpg."""

import asyncpg
from contextlib import asynccontextmanager
from typing import Optional
from helios.config.settings import settings
from helios.utils.logger import helios_logger as logger


class DatabasePool:
    """Manages PostgreSQL connection pool."""
    
    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self) -> None:
        """Initialize the database connection pool."""
        try:
            self._pool = await asyncpg.create_pool(
                host=settings.postgres_host,
                port=settings.postgres_port,
                database=settings.postgres_db,
                user=settings.postgres_user,
                password=settings.postgres_password,
                min_size=10,
                max_size=20,
                command_timeout=60,
            )
            logger.info("Database pool initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {str(e)}")
            raise
    
    async def close(self) -> None:
        """Close the database connection pool."""
        if self._pool:
            await self._pool.close()
            logger.info("Database pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire a database connection from the pool."""
        if not self._pool:
            raise RuntimeError("Database pool not initialized")
        
        async with self._pool.acquire() as connection:
            yield connection
    
    async def execute(self, query: str, *args) -> str:
        """Execute a query without returning results."""
        async with self.acquire() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args) -> list:
        """Execute a query and fetch all results."""
        async with self.acquire() as conn:
            return await conn.fetch(query, *args)
    
    async def fetchrow(self, query: str, *args) -> Optional[asyncpg.Record]:
        """Execute a query and fetch a single row."""
        async with self.acquire() as conn:
            return await conn.fetchrow(query, *args)
    
    async def fetchval(self, query: str, *args) -> any:
        """Execute a query and fetch a single value."""
        async with self.acquire() as conn:
            return await conn.fetchval(query, *args)


# Global database pool instance
db_pool = DatabasePool()
