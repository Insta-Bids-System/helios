import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi } from '../services/api';
import socketService from '../services/socket';
import TaskFlow from './TaskFlow';
import AgentActivity from './AgentActivity';
import { Layers, Activity, FileCode, PlayCircle } from 'lucide-react';

interface ProjectCanvasProps {
  projectId: string | null;
}

const ProjectCanvas: React.FC<ProjectCanvasProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<'flow' | 'agents' | 'artifacts'>('flow');
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectId ? projectApi.get(projectId) : null,
    enabled: !!projectId,
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => projectId ? projectApi.getTasks(projectId) : null,
    enabled: !!projectId,
  });

  const { data: artifacts } = useQuery({
    queryKey: ['artifacts', projectId],
    queryFn: () => projectId ? projectApi.getArtifacts(projectId) : null,
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) return;

    socketService.joinProject(projectId);

    const unsubscribers = [
      socketService.on('agent:state', (data: any) => {
        if (data.projectId === projectId) {
          setCurrentAgent(data.agentRole);
        }
      }),
      socketService.on('log:created', (data: any) => {
        if (data.projectId === projectId) {
          setAgentLogs(prev => [...prev, data.log]);
        }
      }),
    ];

    return () => {
      socketService.leaveProject(projectId);
      unsubscribers.forEach(unsub => unsub());
    };
  }, [projectId]);
  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <PlayCircle size={64} className="mx-auto text-gray-700 mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No Project Selected</h3>
          <p className="text-gray-500">Use the chat to create a new project or select one from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Project Header */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-2xl font-bold mb-2">{project?.name}</h2>
        <p className="text-gray-400">{project?.description}</p>
        <div className="flex items-center gap-4 mt-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            project?.status === 'running' ? 'bg-yellow-900/50 text-yellow-400' :
            project?.status === 'completed' ? 'bg-green-900/50 text-green-400' :
            project?.status === 'failed' ? 'bg-red-900/50 text-red-400' :
            'bg-gray-700 text-gray-300'
          }`}>
            {project?.status}
          </span>
          <span className="text-sm text-gray-500">
            Created: {project && new Date(project.created_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('flow')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'flow' 
              ? 'bg-orange-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Layers size={20} />
          Task Flow
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'agents' 
              ? 'bg-orange-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Activity size={20} />
          Agent Activity
        </button>
        <button
          onClick={() => setActiveTab('artifacts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'artifacts' 
              ? 'bg-orange-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <FileCode size={20} />
          Artifacts ({artifacts?.length || 0})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'flow' && (
          <TaskFlow tasks={tasks || []} currentAgent={currentAgent} />
        )}
        {activeTab === 'agents' && (
          <AgentActivity 
            currentAgent={currentAgent} 
            logs={agentLogs}
            tasks={tasks || []}
          />
        )}
        {activeTab === 'artifacts' && (
          <div className="grid gap-4">
            {artifacts?.map((artifact) => (
              <div key={artifact.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{artifact.name}</h4>
                    <p className="text-sm text-gray-400">
                      Type: {artifact.type} | Version: {artifact.version}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    by {artifact.created_by}
                  </span>
                </div>
                <pre className="bg-gray-900 rounded p-3 text-xs overflow-x-auto">
                  <code>{artifact.content}</code>
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectCanvas;