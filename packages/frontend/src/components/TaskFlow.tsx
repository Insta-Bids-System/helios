import React from 'react';
import { Task } from '../services/api';
import { CheckCircle, Circle, Clock, AlertCircle, ArrowRight } from 'lucide-react';

interface TaskFlowProps {
  tasks: Task[];
  currentAgent: string | null;
}

const TaskFlow: React.FC<TaskFlowProps> = ({ tasks, currentAgent }) => {
  const getTaskIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-400" size={20} />;
      case 'in_progress':
        return <Clock className="text-yellow-400 animate-pulse" size={20} />;
      case 'failed':
        return <AlertCircle className="text-red-400" size={20} />;
      default:
        return <Circle className="text-gray-500" size={20} />;
    }
  };

  // Group tasks by phase
  const taskPhases = tasks.reduce((acc, task) => {
    const phase = task.assigned_to || 'unassigned';
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const phaseOrder = [
    'Product Manager',
    'Frontend Engineer',
    'Backend Engineer',
    'Fullstack Engineer',
    'DevOps Engineer',
    'QA Engineer',
    'Code Reviewer',
    'Integration Specialist'
  ];

  return (
    <div className="space-y-8">
      {phaseOrder.map((phase, phaseIndex) => {
        const phaseTasks = taskPhases[phase] || [];
        if (phaseTasks.length === 0) return null;

        const isCurrentPhase = currentAgent?.toLowerCase().replace(' ', '') === 
                               phase.toLowerCase().replace(' ', '');

        return (
          <div key={phase} className="relative">
            {/* Phase Header */}
            <div className={`flex items-center gap-3 mb-4 ${
              isCurrentPhase ? 'text-orange-400' : 'text-gray-400'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isCurrentPhase ? 'bg-orange-600' : 'bg-gray-800'
              }`}>
                {phaseIndex + 1}
              </div>
              <h3 className="text-lg font-semibold">{phase}</h3>
              {isCurrentPhase && (
                <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-1 rounded-full">
                  Active
                </span>
              )}
            </div>

            {/* Tasks */}
            <div className="ml-5 pl-8 border-l-2 border-gray-800 space-y-3">
              {phaseTasks.map((task) => (
                <div
                  key={task.id}
                  className={`bg-gray-800 rounded-lg p-4 ${
                    task.status === 'in_progress' ? 'ring-2 ring-orange-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {getTaskIcon(task.status)}
                        <h4 className="font-medium">{task.name}</h4>
                      </div>
                      <p className="text-sm text-gray-400 mt-2">{task.description}</p>
                      {task.dependencies.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Dependencies: {task.dependencies.length}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Connector to next phase */}
            {phaseIndex < phaseOrder.length - 1 && (
              <div className="flex justify-center my-4">
                <ArrowRight className="text-gray-600" size={24} />
              </div>
            )}
          </div>
        );
      })}

      {tasks.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <Clock className="mx-auto mb-4" size={48} />
          <p>Waiting for agents to create tasks...</p>
        </div>
      )}
    </div>
  );
};

export default TaskFlow;
