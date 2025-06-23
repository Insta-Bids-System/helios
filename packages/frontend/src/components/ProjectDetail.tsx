import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi, AgentLog } from '../services/api';
import socketService from '../services/socket';
import AgentGraph from './AgentGraph';

interface TabProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

const Tab: React.FC<TabProps> = ({ label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium transition-colors ${
      active
        ? 'text-primary-400 border-b-2 border-primary-400'
        : 'text-gray-400 hover:text-white'
    }`}
  >
    {label} {count !== undefined && <span className="text-sm">({count})</span>}
  </button>
);

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'artifacts' | 'logs'>('overview');
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.get(id!),
    enabled: !!id,
  });
  // Fetch tasks
  const { data: tasks } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => projectApi.getTasks(id!),
    enabled: !!id,
  });

  // Fetch artifacts
  const { data: artifacts } = useQuery({
    queryKey: ['artifacts', id],
    queryFn: () => projectApi.getArtifacts(id!),
    enabled: !!id,
  });

  // Mutations
  const pauseMutation = useMutation({
    mutationFn: () => projectApi.pause(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => projectApi.resume(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  // Socket event handling
  useEffect(() => {
    if (!id) return;

    socketService.joinProject(id);

    const unsubscribers = [
      socketService.on('project:update', (data: any) => {
        if (data.project.id === id) {
          queryClient.setQueryData(['project', id], data.project);
          if (data.currentAgent) {
            setCurrentAgent(data.currentAgent);
          }
        }
      }),
      socketService.on('agent:state', (data: any) => {
        if (data.projectId === id) {
          setCurrentAgent(data.agentRole);
        }
      }),
      socketService.on('task:created', (data: any) => {
        if (data.projectId === id) {
          queryClient.invalidateQueries({ queryKey: ['tasks', id] });
        }
      }),
      socketService.on('task:updated', (data: any) => {
        if (data.projectId === id) {
          queryClient.invalidateQueries({ queryKey: ['tasks', id] });
        }
      }),
      socketService.on('artifact:created', (data: any) => {
        if (data.projectId === id) {
          queryClient.invalidateQueries({ queryKey: ['artifacts', id] });
        }
      }),
      socketService.on('log:created', (data: any) => {
        if (data.projectId === id) {
          setLogs(prev => [...prev, data.log]);
        }
      }),
    ];

    return () => {
      socketService.leaveProject(id);
      unsubscribers.forEach(unsub => unsub());
    };
  }, [id, queryClient]);
  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading project details...</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-400 bg-green-400/10';
      case 'completed':
        return 'text-blue-400 bg-blue-400/10';
      case 'failed':
        return 'text-red-400 bg-red-400/10';
      case 'paused':
        return 'text-yellow-400 bg-yellow-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <AgentGraph 
        projectId={id!} 
        currentAgent={currentAgent}
        tasks={tasks || []}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Project Information</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-gray-400 text-sm">Status</dt>
              <dd className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mt-1 ${getStatusColor(project.status)}`}>
                {project.status}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400 text-sm">Created</dt>
              <dd className="text-white">{new Date(project.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-sm">Last Updated</dt>
              <dd className="text-white">{new Date(project.updated_at).toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Progress Summary</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-gray-400 text-sm">Tasks</dt>
              <dd className="text-white">
                {tasks?.filter(t => t.status === 'completed').length || 0} / {tasks?.length || 0} completed
              </dd>
            </div>
            <div>
              <dt className="text-gray-400 text-sm">Artifacts</dt>
              <dd className="text-white">{artifacts?.length || 0} generated</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-sm">Current Agent</dt>
              <dd className="text-white">{currentAgent || 'None'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
  const renderTasks = () => (
    <div className="space-y-4">
      {tasks?.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No tasks created yet</p>
        </div>
      ) : (
        tasks?.map((task) => (
          <div key={task.id} className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-white">{task.name}</h4>
                <p className="text-gray-400 text-sm mt-1">{task.description}</p>
                {task.assigned_to && (
                  <p className="text-sm text-gray-500 mt-2">Assigned to: {task.assigned_to}</p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                task.status === 'completed' ? 'bg-green-900/20 text-green-400' :
                task.status === 'in_progress' ? 'bg-yellow-900/20 text-yellow-400' :
                task.status === 'failed' ? 'bg-red-900/20 text-red-400' :
                'bg-gray-700 text-gray-300'
              }`}>
                {task.status}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
  const renderArtifacts = () => (
    <div className="space-y-4">
      {artifacts?.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No artifacts generated yet</p>
        </div>
      ) : (
        artifacts?.map((artifact) => (
          <div key={artifact.id} className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-medium text-white">{artifact.name}</h4>
                <p className="text-sm text-gray-400">
                  Type: {artifact.type} | Version: {artifact.version} | Created by: {artifact.created_by}
                </p>
              </div>
              <button
                onClick={() => {/* TODO: Implement artifact viewer */}}
                className="text-primary-400 hover:text-primary-300 text-sm"
              >
                View
              </button>
            </div>
            <pre className="bg-gray-900 rounded p-3 text-xs text-gray-300 overflow-x-auto max-h-32">
              {artifact.content}
            </pre>
          </div>
        ))
      )}
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-2">
      {logs.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No logs yet. Waiting for agent activity...</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="border-b border-gray-800 pb-2 mb-2 last:border-0">
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="text-xs font-medium text-primary-400">{log.agent_role}</span>
                <span className="text-xs text-gray-300">{log.action_type}</span>
              </div>
              {log.action_details.message && (
                <p className="text-xs text-gray-400 ml-16 mt-1">{log.action_details.message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/projects')}
            className="text-gray-400 hover:text-white mb-2 inline-flex items-center gap-2"
          >
            ← Back to Projects
          </button>
          <h1 className="text-3xl font-bold text-primary-400">{project.name}</h1>
          <p className="text-gray-400 mt-1">{project.description}</p>
        </div>
        <div className="flex items-center gap-3">
          {project.status === 'running' && (
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {pauseMutation.isPending ? 'Pausing...' : 'Pause'}
            </button>
          )}
          {project.status === 'paused' && (
            <button
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {resumeMutation.isPending ? 'Resuming...' : 'Resume'}
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-gray-700">
        <nav className="flex gap-4">
          <Tab
            label="Overview"
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <Tab
            label="Tasks"
            count={tasks?.length}
            active={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
          />
          <Tab
            label="Artifacts"
            count={artifacts?.length}
            active={activeTab === 'artifacts'}
            onClick={() => setActiveTab('artifacts')}
          />
          <Tab
            label="Logs"
            count={logs.length}
            active={activeTab === 'logs'}
            onClick={() => setActiveTab('logs')}
          />
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'artifacts' && renderArtifacts()}
        {activeTab === 'logs' && renderLogs()}
      </div>
    </div>
  );
};

export default ProjectDetail;