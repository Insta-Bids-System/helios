// In-memory storage for demo purposes when database is not available
import { v4 as uuidv4 } from 'uuid';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

interface Task {
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

interface Artifact {
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

class InMemoryStorage {
  private projects: Map<string, Project> = new Map();
  private tasks: Map<string, Task[]> = new Map();
  private artifacts: Map<string, Artifact[]> = new Map();

  // Projects
  createProject(data: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Project {
    const project: Project = {
      id: uuidv4(),
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.projects.set(project.id, project);
    this.tasks.set(project.id, []);
    this.artifacts.set(project.id, []);
    return project;
  }

  getProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updated = {
      ...project,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  deleteProject(id: string): boolean {
    const deleted = this.projects.delete(id);
    if (deleted) {
      this.tasks.delete(id);
      this.artifacts.delete(id);
    }
    return deleted;
  }

  // Tasks
  createTask(projectId: string, data: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Task | undefined {
    const projectTasks = this.tasks.get(projectId);
    if (!projectTasks) return undefined;

    const task: Task = {
      id: uuidv4(),
      ...data,
      project_id: projectId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    projectTasks.push(task);
    return task;
  }

  getTasks(projectId: string): Task[] {
    return this.tasks.get(projectId) || [];
  }

  updateTask(projectId: string, taskId: string, updates: Partial<Task>): Task | undefined {
    const projectTasks = this.tasks.get(projectId);
    if (!projectTasks) return undefined;

    const taskIndex = projectTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return undefined;

    projectTasks[taskIndex] = {
      ...projectTasks[taskIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return projectTasks[task