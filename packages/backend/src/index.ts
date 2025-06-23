import express, { Express } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import pool from './config/database';
import { AgentRegistry, AgentContext, AgentRole } from './agents';
import routes from './routes';

// Load environment variables
dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
  }
});

// Initialize Agent Registry
const agentRegistry = new AgentRegistry();

// Create agent context
const agentContext: AgentContext = {
  db: pool,
  io: io as any, // Cast to Socket type expected by AgentContext
  logger,
  config: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    logLevel: 'info'
  }
};

// Store context and registry on app for access in routes
(app as any).agentContext = agentContext;
(app as any).agentRegistry = agentRegistry;

// Export for use in other modules
export { agentContext, agentRegistry };

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    agents: {
      total: agentRegistry.getAllAgents().length,
      byRole: Object.fromEntries(
        Object.values(AgentRole).map(role => [
          role,
          agentRegistry.getAgentsByRole(role as AgentRole).length
        ])
      )
    }
  });
});

// Socket.io Namespaces for Agent Communication
const agentNamespace = io.of('/agents');
const projectNamespace = io.of('/projects');

// Agent namespace for inter-agent communication
agentNamespace.on('connection', (socket) => {
  logger.info(`Agent connected to namespace: ${socket.id}`);
  
  // Agent registration
  socket.on('register', (data: { agentId: string; role: string }) => {
    socket.join(`agent:${data.agentId}`);
    logger.info(`Agent ${data.agentId} registered with role ${data.role}`);
  });
  
  // Inter-agent messaging
  socket.on('agent_message', (message: any) => {
    agentNamespace.to(`agent:${message.to}`).emit('message', message);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Agent disconnected from namespace: ${socket.id}`);
  });
});

// Project namespace for UI updates
projectNamespace.on('connection', (socket) => {
  logger.info(`Client connected to project namespace: ${socket.id}`);
  
  // Join project room
  socket.on('join_project', (projectId: string) => {
    socket.join(`project:${projectId}`);
    logger.info(`Client ${socket.id} joined project ${projectId}`);
    
    // Send current project agents
    const projectAgents = agentRegistry.getAgentsByProject(projectId);
    socket.emit('project_agents', projectAgents.map(agent => ({
      id: agent.id,
      role: agent.role,
      status: agent.status
    })));
  });
  
  // Leave project room
  socket.on('leave_project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
    logger.info(`Client ${socket.id} left project ${projectId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected from project namespace: ${socket.id}`);
  });
});

// Main Socket.io connection handling (for backward compatibility)
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// API Routes
app.use('/api', routes);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger.info(`Helios backend server running on port ${PORT}`);
  logger.info(`Agent Registry initialized with ${Object.values(AgentRole).length} agent roles`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Shutdown all agents
  const allAgents = agentRegistry.getAllAgents();
  logger.info(`Shutting down ${allAgents.length} active agents`);
  
  await Promise.all(allAgents.map(agent => agent.shutdown()));
  
  // Clear registry
  agentRegistry.clear();
  
  // Close database connection
  await pool.end();
  
  // Close HTTP server
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
