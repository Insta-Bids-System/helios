import React from 'react';
import { Task } from '../services/api';
import { Bot, Activity, CheckCircle, AlertCircle } from 'lucide-react';

interface AgentActivityProps {
  currentAgent: string | null;
  logs: any[];
  tasks: Task[];
}

const AgentActivity: React.FC<AgentActivityProps> = ({ currentAgent, logs, tasks }) => {
  const agents = [
    { id: 'orchestrator', name: 'Orchestrator', role: 'Manages overall project flow' },
    { id: 'productmanager', name: 'Product Manager', role: 'Analyzes requirements' },
    { id: 'frontendengineer', name: 'Frontend Engineer', role: 'Builds UI components' },
    { id: 'backendengineer', name: 'Backend Engineer', role: 'Creates API services' },
    { id: 'fullstackengineer', name: 'Fullstack Engineer', role: 'Builds complete features' },
    { id: 'devopsengineer', name: 'DevOps Engineer', role: 'Handles deployment' },
    { id: 'qaengineer', name: 'QA Engineer', role: 'Tests the application' },
    { id: 'codereviewer', name: 'Code Reviewer', role: 'Reviews code quality' },
    { id: 'integrationspecialist', name: 'Integration Specialist', role: 'Integrates components' },
  ];

  const getAgentStatus = (agentName: string) => {
    const agentId = agentName.toLowerCase().replace(' ', '');
    const isActive = currentAgent?.toLowerCase().replace(' ', '') === agentId;
    const completedTasks = tasks.filter(
      t => t.assigned_to?.toLowerCase().replace(' ', '') === agentId && 
           t.status === 'completed'
    ).length;
    const totalTasks = tasks.filter(
      t => t.assigned_to?.toLowerCase().replace(' ', '') === agentId
    ).length;

    return { isActive, completedTasks, totalTasks };
  };

  return (
    <div className="space-y-6">
      {/* Agent Grid */}
      <div className="grid grid-cols-2 gap-4">
        {agents.map((agent) => {
          const { isActive, completedTasks, totalTasks } = getAgentStatus(agent.name);
          
          return (
            <div
              key={agent.id}
              className={`bg-gray-800 rounded-lg p-4 border-2 transition-all ${
                isActive 
                  ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
                  : 'border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className={isActive ? 'text-orange-400' : 'text-gray-400'} size={20} />
                  <h4 className="font-medium">{agent.name}</h4>
                </div>
                {isActive && (
                  <Activity className="text-orange-400 animate-pulse" size={16} />
                )}
              </div>
              <p className="text-sm text-gray-400 mb-3">{agent.role}</p>
              
              {/* Progress */}
              {totalTasks > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tasks</span>
                    <span>{completedTasks}/{totalTasks}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Activity Logs */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {logs.slice(-10).reverse().map((log, index) => (
            <div key={index} className="bg-gray-800 rounded p-3 text-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-gray-400" />
                  <span className="font-medium text-orange-400">{log.agent_role}</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">{log.action_type}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {log.action_details?.message && (
                <p className="text-gray-300 mt-1 ml-6">{log.action_details.message}</p>
              )}
            </div>
          ))}
          
          {logs.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              No activity yet. Agents will start working once tasks are created.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentActivity;
