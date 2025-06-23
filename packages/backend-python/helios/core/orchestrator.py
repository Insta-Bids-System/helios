"""
Core agent and orchestrator implementations following the Helios blueprint.

This module implements:
- Generic AgentNode class (Task 1.3)
- OrchestratorGraph class (Task 1.3)
- Swarm Router logic (Task 1.4)
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional, Any
from helios.state.models import HeliosSwarmState, AgentRole
from helios.utils.logger import helios_logger as logger


class AgentNode(ABC):
    """
    Generic agent node class as specified in Task 1.3.
    
    All agents in the swarm must inherit from this class and implement
    the execute method.
    """
    
    def __init__(self, name: str):
        """Initialize agent with a name."""
        self.name = name
        logger.info(f"Initialized agent: {name}")
    
    @abstractmethod
    async def execute(self, state: HeliosSwarmState) -> Dict[str, Any]:
        """
        Execute agent logic and return partial state update.
        
        Args:
            state: Current swarm state
            
        Returns:
            Dictionary containing partial state updates
        """
        pass


class OrchestratorGraph:
    """
    The main orchestrator that manages the agent swarm.
    
    Implements Task 1.3 and Task 1.4 - holds a dictionary of AgentNodes
    and implements routing logic based on active_agent field.
    """
    
    def __init__(self):
        """Initialize the orchestrator with an empty agent registry."""
        self.agents: Dict[str, AgentNode] = {}
        logger.info("Initialized OrchestratorGraph")
    
    def register_agent(self, agent: AgentNode) -> None:
        """
        Register an agent in the swarm.
        
        Args:
            agent: AgentNode instance to register
        """
        self.agents[agent.name] = agent
        logger.info(f"Registered agent: {agent.name}")
    
    async def run(self, initial_state: HeliosSwarmState) -> HeliosSwarmState:
        """
        Main execution loop that orchestrates the agent swarm.
        
        Implements the routing logic from Task 1.4:
        - Loops calling execute method of active_agent
        - Updates state based on agent returns
        - Continues until active_agent is 'done'
        
        Args:
            initial_state: Initial swarm state
            
        Returns:
            Final swarm state after all agents complete
        """
        state = initial_state
        iteration = 0
        max_iterations = 100  # Safety limit
        
        logger.info(f"Starting orchestration for project: {state.project_id}")
        
        while state.active_agent != AgentRole.DONE.value and iteration < max_iterations:
            iteration += 1
            active_agent_name = state.active_agent
            
            logger.info(f"Iteration {iteration}: Active agent is {active_agent_name}")
            
            # Check if agent exists
            if active_agent_name not in self.agents:
                logger.error(f"Agent {active_agent_name} not found in registry")
                state.project_status = "failed"
                state.error_message = f"Agent {active_agent_name} not found"
                break
            
            # Get the active agent
            agent = self.agents[active_agent_name]
            
            try:
                # Execute agent and get state updates
                logger.debug(f"Executing agent: {active_agent_name}")
                updates = await agent.execute(state)
                
                # Apply state updates
                for key, value in updates.items():
                    if hasattr(state, key):
                        setattr(state, key, value)
                        logger.debug(f"Updated state.{key} = {value}")
                    else:
                        logger.warning(f"Unknown state attribute: {key}")
                
            except Exception as e:
                logger.error(f"Error in agent {active_agent_name}: {str(e)}")
                state.project_status = "failed"
                state.error_message = f"Agent {active_agent_name} failed: {str(e)}"
                break
        
        if iteration >= max_iterations:
            logger.error("Maximum iterations reached - possible infinite loop")
            state.project_status = "failed"
            state.error_message = "Maximum iterations exceeded"
        
        logger.info(f"Orchestration completed with status: {state.project_status}")
        return state
