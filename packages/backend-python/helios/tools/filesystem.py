"""
File System Manager implementation following Task 1.5 of the blueprint.

Provides atomic file operations restricted to project workspaces.
"""

import os
import tempfile
import shutil
from pathlib import Path
from typing import Optional
from helios.config.settings import settings
from helios.utils.logger import helios_logger as logger


class FileSystemManager:
    """
    Manages file operations for agents with atomic writes.
    
    All operations are restricted to /workspaces/<project_id> directory
    as specified in the blueprint.
    """
    
    def __init__(self, project_id: str):
        """
        Initialize FileSystemManager for a specific project.
        
        Args:
            project_id: Project identifier for workspace isolation
        """
        self.project_id = project_id
        self.workspace_path = Path(settings.workspace_base_path) / project_id
        self._ensure_workspace()
    
    def _ensure_workspace(self) -> None:
        """Ensure the project workspace directory exists."""
        self.workspace_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Ensured workspace exists: {self.workspace_path}")

    def _validate_path(self, file_path: str) -> Path:
        """
        Validate that the path is within the project workspace.
        
        Args:
            file_path: Requested file path
            
        Returns:
            Resolved absolute path
            
        Raises:
            ValueError: If path is outside workspace
        """
        # Resolve the full path
        full_path = (self.workspace_path / file_path).resolve()
        
        # Ensure it's within the workspace
        if not str(full_path).startswith(str(self.workspace_path.resolve())):
            raise ValueError(f"Path {file_path} is outside project workspace")
        
        return full_path
    
    async def atomic_write(self, file_path: str, content: str) -> str:
        """
        Atomically write content to a file.
        
        Implements Task 1.5 requirement:
        - Write to temporary file
        - Perform atomic rename
        - Ensure no partial writes
        
        Args:
            file_path: Path relative to project workspace
            content: Content to write
            
        Returns:
            Absolute path of written file
        """
        # Validate and resolve path
        target_path = self._validate_path(file_path)
        
        # Ensure parent directory exists
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Create temporary file in same directory (for atomic rename)
        temp_fd, temp_path = tempfile.mkstemp(
            dir=str(target_path.parent),
            prefix=".tmp_",
            suffix=target_path.suffix
        )
        
        try:
            # Write content to temporary file
            with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Atomic rename (overwrites if exists)
            shutil.move(temp_path, str(target_path))
            
            logger.info(f"Atomically wrote {len(content)} bytes to {target_path}")
            return str(target_path)
            
        except Exception as e:
            # Clean up temp file on error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            logger.error(f"Failed to write file {file_path}: {str(e)}")
            raise
    
    async def read_file(self, file_path: str) -> str:
        """
        Read content from a file.
        
        Args:
            file_path: Path relative to project workspace
            
        Returns:
            File content
        """
        target_path = self._validate_path(file_path)
        
        if not target_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(target_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        logger.debug(f"Read {len(content)} bytes from {target_path}")
        return content
    
    async def list_files(self, directory: str = "") -> list[str]:
        """
        List files in a directory.
        
        Args:
            directory: Directory path relative to workspace
            
        Returns:
            List of file paths relative to workspace
        """
        dir_path = self._validate_path(directory)
        
        if not dir_path.is_dir():
            raise NotADirectoryError(f"Not a directory: {directory}")
        
        files = []
        for item in dir_path.rglob("*"):
            if item.is_file():
                relative_path = item.relative_to(self.workspace_path)
                files.append(str(relative_path))
        
        logger.debug(f"Listed {len(files)} files in {directory}")
        return files
