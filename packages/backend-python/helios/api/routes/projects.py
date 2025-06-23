"""Project management API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from helios.core.orchestrator import OrchestratorGraph
from helios.state.models import HeliosSwarmState, AgentRole
from helios.db.connection import db_pool
from helios.utils.logger import helios_logger as logger

router = APIRouter()


class CreateProjectRequest(BaseModel):
    """Request model for creating a new project."""
    user_prompt: str
    project_name: Optional[str] = None


class ProjectResponse(BaseModel):
    """Response model for project information."""
    project_id: str
    name: str
    user_prompt: str
    status: str


@router.post("/", response_model=ProjectResponse)
async def create_project(request: CreateProjectRequest):
    """
    Create a new project from a user prompt.
    
    This implements the API endpoint from Task 4.1 that accepts a user prompt,
    initializes a new HeliosSwarmState, and starts the orchestration.
    """
    # Generate project ID
    project_id = str(uuid.uuid4())
    project_name = request.project_name or f"Project-{project_id[:8]}"
    
    logger.info(f"Creating new project: {project_id} - {project_name}")
    
    try:
        # Insert project into database
        await db_pool.execute(
            """
            INSERT INTO helios.projects (id, name, user_prompt, status)
            VALUES ($1, $2, $3, $4)
            """,
            uuid.UUID(project_id),
            project_name,
            request.user_prompt,
            "initializing"
        )
        
        # Initialize swarm state
        initial_state = HeliosSwarmState(
            active_agent=AgentRole.PRODUCT_MANAGER.value,
            project_id=project_id,
            user_prompt=request.user_prompt,
            project_name=project_name,
            project_status="initializing"
        )
        
        # TODO: Start orchestrator in background task
        # For now, just return the created project
        
        return ProjectResponse(
            project_id=project_id,
            name=project_name,
            user_prompt=request.user_prompt,
            status="initializing"
        )
        
    except Exception as e:
        logger.error(f"Failed to create project: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create project")


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get project details by ID."""
    try:
        row = await db_pool.fetchrow(
            "SELECT * FROM helios.projects WHERE id = $1",
            uuid.UUID(project_id)
        )
        
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return ProjectResponse(
            project_id=str(row["id"]),
            name=row["name"],
            user_prompt=row["user_prompt"],
            status=row["status"]
        )
    except Exception as e:
        logger.error(f"Failed to fetch project: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch project")
