"""Configuration management using Pydantic Settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """Application settings following the Helios blueprint."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Server Configuration
    app_name: str = "Helios Backend"
    app_version: str = "1.0.0"
    debug: bool = Field(default=False, env="DEBUG")
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=3000, env="PORT")
    
    # Database Configuration
    postgres_host: str = Field(env="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, env="POSTGRES_PORT")
    postgres_db: str = Field(env="POSTGRES_DB")
    postgres_user: str = Field(env="POSTGRES_USER")
    postgres_password: str = Field(env="POSTGRES_PASSWORD")
    
    # Redis Configuration
    redis_host: str = Field(default="localhost", env="REDIS_HOST")
    redis_port: int = Field(default=6379, env="REDIS_PORT")
    redis_password: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    
    # LLM Configuration (placeholder as per blueprint)
    llm_provider: str = Field(default="placeholder", env="LLM_PROVIDER")
    llm_api_key: Optional[str] = Field(default=None, env="LLM_API_KEY")
    
    # File System Configuration
    workspace_base_path: str = Field(default="/workspaces", env="WORKSPACE_BASE_PATH")
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    
    @property
    def database_url(self) -> str:
        """Construct PostgreSQL database URL."""
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
    
    @property
    def redis_url(self) -> str:
        """Construct Redis URL."""
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}"
        return f"redis://{self.redis_host}:{self.redis_port}"


settings = Settings()
