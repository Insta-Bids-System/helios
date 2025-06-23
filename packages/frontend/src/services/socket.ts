import { io, Socket } from 'socket.io-client';
import { Project, Task, Artifact, AgentLog } from './api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export interface AgentStateUpdate {
  projectId: string;
  agentId: string;
  agentRole: string;
  status: 'IDLE' | 'EXECUTING' | 'WAITING' | 'ERROR' | 'COMPLETED';
  message?: string;
  progress?: number;
}

export interface ProjectUpdate {
  project: Project;
  currentAgent?: string;
  completedAgents?: string[];
  error?: string;
}

export interface TaskUpdate {
  projectId: string;
  task: Task;
}

export interface ArtifactUpdate {
  projectId: string;
  artifact: Artifact;
}

export interface LogUpdate {
  projectId: string;
  log: AgentLog;
}

class SocketService {
  private socket: Socket | null = null;
  private projectSocket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(): void {
    if (this.socket?.connected) return;

    // Main socket for general updates
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false,
    });

    // Project-specific socket namespace
    this.projectSocket = io(`${SOCKET_URL}/projects`, {
      transports: ['websocket'],
      upgrade: false,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket || !this.projectSocket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to Helios backend');
      this.emit('connected', true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Helios backend');
      this.emit('connected', false);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emit('error', error);
    });

    // Project namespace events
    this.projectSocket.on('project:update', (data: ProjectUpdate) => {
      this.emit('project:update', data);
    });

    this.projectSocket.on('project:created', (project: Project) => {
      this.emit('project:created', project);
    });

    this.projectSocket.on('project:completed', (data: { projectId: string; result: any }) => {
      this.emit('project:completed', data);
    });

    this.projectSocket.on('project:error', (data: { projectId: string; error: string }) => {
      this.emit('project:error', data);
    });

    this.projectSocket.on('agent:state', (data: AgentStateUpdate) => {
      this.emit('agent:state', data);
    });

    this.projectSocket.on('task:created', (data: TaskUpdate) => {
      this.emit('task:created', data);
    });

    this.projectSocket.on('task:updated', (data: TaskUpdate) => {
      this.emit('task:updated', data);
    });

    this.projectSocket.on('artifact:created', (data: ArtifactUpdate) => {
      this.emit('artifact:created', data);
    });

    this.projectSocket.on('log:created', (data: LogUpdate) => {
      this.emit('log:created', data);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.projectSocket?.disconnect();
    this.socket = null;
    this.projectSocket = null;
    this.listeners.clear();
  }

  joinProject(projectId: string): void {
    this.projectSocket?.emit('join:project', projectId);
  }

  leaveProject(projectId: string): void {
    this.projectSocket?.emit('leave:project', projectId);
  }

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Subscribe to SSE for real-time monitoring
  subscribeToMonitoring(projectId: string, onMessage: (data: any) => void): () => void {
    const eventSource = new EventSource(`${SOCKET_URL}/api/monitor/stream/${projectId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
