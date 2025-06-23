import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../services/api';
import socketService from '../services/socket';

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [connectedToSocket, setConnectedToSocket] = useState(false);

  // Fetch projects
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.list,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Socket connection and event handling
  useEffect(() => {
    socketService.connect();

    const unsubscribeConnected = socketService.on('connected', setConnectedToSocket);
    const unsubscribeProjectUpdate = socketService.on('project:update', () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    });
    const unsubscribeProjectCreated = socketService.on('project:created', () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    });

    return () => {
      unsubscribeConnected();
      unsubscribeProjectUpdate();
      unsubscribeProjectCreated();
    };
  }, [queryClient]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return '▶';
      case 'completed':
        return '✓';
      case 'failed':
        return '✗';
      case 'paused':
        return '❚❚';
      default:
        return '○';
    }
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteMutation.mutateAsync(projectId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">Error loading projects: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary-400">Projects</h1>
          <p className="text-gray-400 mt-1">Manage your Helios agent swarm projects</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            connectedToSocket ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connectedToSocket ? 'bg-green-400' : 'bg-red-400'
            }`} />
            {connectedToSocket ? 'Connected' : 'Disconnected'}
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + New Project
          </button>
        </div>
      </div>

      {projects?.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-400 mb-4">No projects yet. Create your first project to get started!</p>
          <button
            onClick={() => navigate('/projects/new')}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-750 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-white group-hover:text-primary-400 transition-colors">
                  {project.name}
                </h3>
                <button
                  onClick={(e) => handleDelete(e, project.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all"
                  title="Delete project"
                >
                  ✗
                </button>
              </div>
              
              <p className="text-gray-400 mb-4 line-clamp-2">{project.description}</p>
              
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
                  <span>{getStatusIcon(project.status)}</span>
                  {project.status}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
