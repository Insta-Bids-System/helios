"""
Core state definitions for the Helios Swarm following the blueprint.

This module defines the HeliosSwarmState interface as specified in Task 1.3.
"""

from typing import List, Dict, Any, Optional, Literal
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    IN_PROGRESS = "in_progress"


class AgentRole(str, Enum):
    """Available agent roles in the swarm."""
    ORCHESTRATOR = "orchestrator"
    PRODUCT_MANAGER = "product_manager"
    BACKEND_ENGINEER = "backend_engineer"
    QA_ENGINEER = "qa_engineer"
    DONE = "done"


@dataclass
class Task:
    """Task representation in the system."""
    id: str
    project_id: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    dependencies: List[str] = field(default_factory=list)
    assigned_agent: Optional[AgentRole] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


@dataclass
class Artifact:
    """Artifact representation for generated files."""
    id: str
    project_id: str
    file_path: str
    content: str
    version: int = 1
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AgentLog:
    """Log entry for agent actions."""
    id: str
    project_id: str
    agent_role: AgentRole
    action_details: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class HeliosSwarmState:
    """
    Central state object for the Helios swarm system.
    
    This is the single source of truth for the project, containing the active plan,
    generated artifacts, and control flags as per the blueprint specification.
    """
    active_agent: str  # Current active agent name
    project_id: str
    user_prompt: str
    plan: List[Task] = field(default_factory=list)
    artifacts: List[Artifact] = field(default_factory=list)
    agent_logs: List[AgentLog] = field(default_factory=list)
    
    # Additional state tracking
    project_name: str = ""
    project_status: Literal["initializing", "planning", "executing", "testing", "completed", "failed"] = "initializing"
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert state to dictionary for serialization."""
        return {
            "active_agent": self.active_agent,
            "project_id": self.project_id,
            "user_prompt": self.user_prompt,
            "plan": [task.__dict__ for task in self.plan],
            "artifacts": [artifact.__dict__ for artifact in self.artifacts],
            "agent_logs": [log.__dict__ for log in self.agent_logs],
            "project_name": self.project_name,
            "project_status": self.project_status,
            "error_message": self.error_message,
            "metadata": self.metadata,
        }
