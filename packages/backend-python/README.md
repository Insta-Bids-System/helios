# Helios Backend (Python)

Python implementation of the Helios multi-agent system backend following the definitive blueprint.

## Architecture

The backend implements the following core components from the Helios blueprint:

- **OrchestratorGraph**: Main execution loop managing agent swarm
- **AgentNode**: Base class for all agents
- **HeliosSwarmState**: Central state object for agent communication
- **FileSystemManager**: Atomic file operations for agents
- **Database Layer**: PostgreSQL with asyncpg
- **Real-time Updates**: Socket.IO integration
- **API**: FastAPI with async support

## Directory Structure

```
helios/
├── api/           # FastAPI routes and endpoints
├── agents/        # Agent implementations
├── core/          # Core orchestrator and graph logic
├── db/            # Database connection and models
├── state/         # State management and models
├── tools/         # Agent tools (filesystem, etc.)
├── utils/         # Utilities (logger, etc.)
└── config/        # Configuration management
```

## Setup

1. Install Poetry:
```bash
pip install poetry
```

2. Install dependencies:
```bash
poetry install
```

3. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
poetry run python -m helios.db.migrate
```

5. Start the server:
```bash
poetry run python -m helios.main
```

## Development

### Code Quality

- **Formatting**: `poetry run black helios/`
- **Linting**: `poetry run ruff check helios/`
- **Type Checking**: `poetry run mypy helios/`
- **Tests**: `poetry run pytest`

### Key Design Decisions

1. **Async-First**: All I/O operations are async using asyncio
2. **Type Safety**: Strict typing with mypy and Pydantic
3. **Atomic Operations**: File writes use temp file + rename pattern
4. **State Management**: Single source of truth via HeliosSwarmState
5. **Blueprint Compliance**: Strictly follows the Helios v3 blueprint

## API Endpoints

- `POST /api/projects` - Create new project from user prompt
- `GET /api/projects/{id}` - Get project details
- `GET /api/health` - Health check
- `WS /socket.io` - Real-time updates

## Environment Variables

See `.env.example` for all configuration options.
