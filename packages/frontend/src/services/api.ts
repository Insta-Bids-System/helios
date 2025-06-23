import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

console.log('API Base URL:', API_BASE_URL); // Debug log

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token (if needed in future)
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface Task {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assigned_to?: string;
  dependencies: string[];
  result?: any;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  id: string;
  project_id: string;
  name: string;
  type: string;
  content: string;
  version: number;
  is_latest: boolean;
  created_by: string;
  created_at: string;
}

export interface AgentLog {
  id: string;
  project_id: string;
  agent_id: string;
  agent_role: string;
  action_type: string;
  action_details: Record<string, any>;
  timestamp: string;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  requirements?: string[];
  metadata?: Record<string, any>;
}

// Project API endpoints
export const projectApi = {
  // Create a new project
  create: async (data: CreateProjectRequest): Promise<Project> => {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },

  // Get all projects
  list: async (): Promise<Project[]> => {
    const response = await api.get<{ projects: Project[]; total: number }>('/projects');
    return response.data.projects;
  },

  // Get a specific project
  get: async (id: string): Promise<Project> => {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  },

  // Pause a project
  pause: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/projects/${id}/pause`);
    return response.data;
  },

  // Resume a project
  resume: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/projects/${id}/resume`);
    return response.data;
  },

  // Get project tasks
  getTasks: async (id: string): Promise<Task[]> => {
    const response = await api.get<Task[]>(`/projects/${id}/tasks`);
    return response.data;
  },

  // Get project artifacts
  getArtifacts: async (id: string): Promise<Artifact[]> => {
    const response = await api.get<Artifact[]>(`/projects/${id}/artifacts`);
    return response.data;
  },

  // Delete a project
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },
};

// Monitoring API endpoints
export const monitorApi = {
  // Get global agent activity
  getAgentActivity: async (): Promise<any> => {
    const response = await api.get('/monitor/agents');
    return response.data;
  },

  // Get project monitoring data
  getProjectMonitoring: async (projectId: string): Promise<any> => {
    const response = await api.get(`/monitor/projects/${projectId}`);
    return response.data;
  },
};

export default api;
