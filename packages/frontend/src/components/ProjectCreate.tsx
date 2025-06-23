import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { projectApi, CreateProjectRequest } from '../services/api';

const ProjectCreate: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: '',
    description: '',
    requirements: [''],
    metadata: {},
  });

  const createMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: (project) => {
      navigate(`/projects/${project.id}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty requirements
    const filteredRequirements = formData.requirements?.filter(req => req.trim() !== '');
    
    await createMutation.mutateAsync({
      ...formData,
      requirements: filteredRequirements,
    });
  };

  const handleAddRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requirements: [...(prev.requirements || []), ''],
    }));
  };
  const handleRemoveRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleRequirementChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements?.map((req, i) => i === index ? value : req) || [],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary-400">Create New Project</h1>
        <p className="text-gray-400 mt-2">Define your project and let the agent swarm build it for you</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            Project Name *
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:outline-none"
            placeholder="My Awesome App"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
            Project Description *
          </label>
          <textarea
            id="description"
            required
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:outline-none"
            rows={4}
            placeholder="Describe what you want to build..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Requirements
            </label>
            <button
              type="button"
              onClick={handleAddRequirement}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              + Add Requirement
            </button>
          </div>
          <div className="space-y-2">
            {formData.requirements?.map((req, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={req}
                  onChange={(e) => handleRequirementChange(index, e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:outline-none"
                  placeholder="Enter a requirement..."
                />
                <button
                  type="button"
                  onClick={() => handleRemoveRequirement(index)}
                  className="text-red-400 hover:text-red-300 px-2"
                >
                  ✗
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                createMutation.isPending
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>

        {createMutation.isError && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mt-4">
            <p className="text-red-400">
              Error creating project: {(createMutation.error as Error).message}
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

export default ProjectCreate;