import React, { useMemo } from 'react';
import { Task } from '../services/api';

interface AgentGraphProps {
  projectId: string;
  currentAgent: string | null;
  tasks: Task[];
}

interface AgentNode {
  id: string;
  label: string;
  status: 'idle' | 'active' | 'completed' | 'error';
  x: number;
  y: number;
}

interface AgentEdge {
  from: string;
  to: string;
  label?: string;
}

const AgentGraph: React.FC<AgentGraphProps> = ({ currentAgent, tasks }) => {
  const agents: AgentNode[] = [
    { id: 'orchestrator', label: 'Orchestrator', status: 'idle', x: 400, y: 50 },
    { id: 'product_manager', label: 'Product Manager', status: 'idle', x: 400, y: 150 },
    { id: 'frontend_engineer', label: 'Frontend Engineer', status: 'idle', x: 200, y: 250 },
    { id: 'backend_engineer', label: 'Backend Engineer', status: 'idle', x: 400, y: 250 },
    { id: 'fullstack_engineer', label: 'Fullstack Engineer', status: 'idle', x: 600, y: 250 },
    { id: 'devops_engineer', label: 'DevOps Engineer', status: 'idle', x: 300, y: 350 },
    { id: 'qa_engineer', label: 'QA Engineer', status: 'idle', x: 500, y: 350 },
    { id: 'code_reviewer', label: 'Code Reviewer', status: 'idle', x: 400, y: 450 },
    { id: 'integration_specialist', label: 'Integration Specialist', status: 'idle', x: 400, y: 550 },
  ];

  const edges: AgentEdge[] = [
    { from: 'orchestrator', to: 'product_manager' },
    { from: 'product_manager', to: 'frontend_engineer', label: 'UI needed' },
    { from: 'product_manager', to: 'backend_engineer', label: 'API needed' },
    { from: 'product_manager', to: 'fullstack_engineer', label: 'Full app' },
    { from: 'frontend_engineer', to: 'devops_engineer' },
    { from: 'backend_engineer', to: 'devops_engineer' },
    { from: 'fullstack_engineer', to: 'devops_engineer' },
    { from: 'devops_engineer', to: 'qa_engineer' },
    { from: 'qa_engineer', to: 'code_reviewer' },
    { from: 'code_reviewer', to: 'integration_specialist', label: 'Approved' },
    { from: 'code_reviewer', to: 'frontend_engineer', label: 'Fix issues' },
    { from: 'code_reviewer', to: 'backend_engineer', label: 'Fix issues' },
    { from: 'code_reviewer', to: 'fullstack_engineer', label: 'Fix issues' },
  ];

  // Update agent statuses based on current agent and tasks
  const updatedAgents = useMemo(() => {
    return agents.map(agent => {
      if (currentAgent && currentAgent.toLowerCase() === agent.id.replace('_', '')) {
        return { ...agent, status: 'active' as const };
      }
      
      const hasCompletedTask = tasks.some(
        task => task.assigned_to?.toLowerCase() === agent.id.replace('_', '') && 
                task.status === 'completed'
      );
      
      if (hasCompletedTask) {
        return { ...agent, status: 'completed' as const };
      }
      
      return agent;
    });
  }, [currentAgent, tasks]);
  const getNodeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'fill-green-500';
      case 'completed':
        return 'fill-blue-500';
      case 'error':
        return 'fill-red-500';
      default:
        return 'fill-gray-600';
    }
  };

  const getNodeStroke = (status: string) => {
    switch (status) {
      case 'active':
        return 'stroke-green-400';
      case 'completed':
        return 'stroke-blue-400';
      case 'error':
        return 'stroke-red-400';
      default:
        return 'stroke-gray-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Agent Workflow</h3>
      <div className="relative overflow-x-auto">
        <svg width="800" height="650" className="mx-auto">
          {/* Draw edges */}
          {edges.map((edge, index) => {
            const fromNode = updatedAgents.find(n => n.id === edge.from);
            const toNode = updatedAgents.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const isActive = currentAgent && 
              (fromNode.status === 'completed' || fromNode.status === 'active') &&
              toNode.status === 'active';

            return (
              <g key={index}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={isActive ? '#10b981' : '#6b7280'}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? '0' : '5,5'}
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text
                    x={(fromNode.x + toNode.x) / 2}
                    y={(fromNode.y + toNode.y) / 2}
                    className="fill-gray-400 text-xs"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"
              />
            </marker>
          </defs>

          {/* Draw nodes */}
          {updatedAgents.map((node) => (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              {/* Node circle */}
              <circle
                r="40"
                className={`${getNodeColor(node.status)} ${getNodeStroke(node.status)} transition-all duration-300`}
                strokeWidth="2"
              />
              
              {/* Active node animation */}
              {node.status === 'active' && (
                <circle
                  r="40"
                  className="fill-none stroke-green-400 animate-ping"
                  strokeWidth="2"
                />
              )}
              
              {/* Node label */}
              <text
                className="fill-white text-xs font-medium"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {node.label.split(' ').map((word, i) => (
                  <tspan key={i} x="0" dy={i === 0 ? '-0.3em' : '1.2em'}>
                    {word}
                  </tspan>
                ))}
              </text>
            </g>
          ))}
        </svg>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-600 border-2 border-gray-500"></div>
          <span className="text-gray-400">Idle</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-400"></div>
          <span className="text-gray-400">Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-400"></div>
          <span className="text-gray-400">Completed</span>
        </div>
      </div>
    </div>
  );
};

export default AgentGraph;