import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi } from '../services/api';
import { Folder, FolderOpen, Clock, CheckCircle, AlertCircle, Pause } from 'lucide-react';

interface SidebarProps {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedProjectId, onSelectProject }) => {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.list,
    refetchInterval: 5000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="animate-spin" size={16} />;
      case 'completed':
        return <CheckCircle size={16} />;
      case 'failed':
        return <AlertCircle size={16} />;
      case 'paused':
        return <Pause size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-yellow-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'paused':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Folder size={20} />
          Projects
        </h2>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="text-center text-gray-500 py-4">Loading...</div>
        ) : projects?.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No projects yet. Use the chat to create one!
          </div>
        ) : (
          <div className="space-y-1">
            {projects?.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedProjectId === project.id
                    ? 'bg-gray-800 border border-gray-700'
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {selectedProjectId === project.id ? (
                        <FolderOpen size={16} className="text-orange-400" />
                      ) : (
                        <Folder size={16} className="text-gray-400" />
                      )}
                      <h3 className="font-medium text-sm truncate">{project.name}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{project.description}</p>
                  </div>
                  <div className={`ml-2 ${getStatusColor(project.status)}`}>
                    {getStatusIcon(project.status)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Total Projects:</span>
          <span className="font-mono">{projects?.length || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
