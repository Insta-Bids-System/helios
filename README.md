# Helios Generative Agent Swarm

A sophisticated multi-agent system for autonomous software development, implementing a swarm of specialized AI agents that can design, build, test, and deploy complete software applications from natural language specifications.

## Architecture Overview

Helios implements the following key patterns:
- **Planner/Executor Pattern**: Decomposes abstract goals into concrete plans
- **Swarm Orchestration**: Global StateGraph orchestrating specialized agents
- **State-Based Communication**: Strongly-typed shared state for agent collaboration
- **Explicit Handoffs**: Control flow via dedicated handoff tools
- **Self-Correction Loops**: Generate → Validate → Correct cycles at both micro and macro levels

## Technology Stack

- **Backend**: Node.js with TypeScript
- **State Machine**: Native TypeScript implementation of langgraph patterns
- **Database**: PostgreSQL
- **Message Bus**: Redis (Pub/Sub)
- **Frontend**: React with TypeScript & Tailwind CSS
- **Real-time**: WebSockets (Socket.io)
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- npm 9+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Insta-Bids-System/helios.git
cd helios
```

2. Set up environment variables:
```bash
# Copy the Docker environment example
cp .env.docker.example .env.docker

# Edit .env.docker and add your Supabase credentials
# (Required for monitoring features)

# For backend-specific configuration
cd packages/backend
cp .env.example .env
# Edit .env with your LLM API keys and other settings
cd ../..
```

3. Install dependencies:
```bash
npm install
```

4. Start the infrastructure:
```bash
# This will use the .env.docker file automatically
docker-compose up -d
```

5. Run database migrations:
```bash
# Wait for PostgreSQL to be ready, then:
docker-compose exec backend npm run migrate
```

6. Start the development servers:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Project Structure

- `/packages/backend` - Node.js/TypeScript backend with agent runtime
- `/packages/frontend` - React/TypeScript frontend (Mission Control UI)
- `/workspaces` - Agent-generated project workspaces

## Documentation

- [Environment Setup Guide](./docs/ENVIRONMENT_SETUP.md) - Detailed guide on configuring environment variables
- [Supabase Setup](./packages/backend/SUPABASE_SETUP.md) - Instructions for setting up Supabase monitoring
- [Database Monitoring](./packages/backend/DATABASE_MONITORING.md) - Overview of the monitoring architecture

## Development

See individual package READMEs for detailed development instructions.

## License

MIT
