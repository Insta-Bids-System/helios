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
git clone https://github.com/your-org/helios.git
cd helios
```

2. Install dependencies:
```bash
npm install
```

3. Start the infrastructure:
```bash
npm run docker:up
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the development servers:
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

## Development

See individual package READMEs for detailed development instructions.

## License

MIT
