# Environment Configuration Guide

This guide explains how environment variables are organized in the Helios project to avoid conflicts and maintain security.

## Overview

The Helios project uses multiple environment files for different purposes:

1. **`.env.docker`** (root level) - Used by Docker Compose for container configuration
2. **`packages/backend/.env`** - Used by the backend application at runtime
3. **`packages/frontend/.env`** - Used by the frontend application (Vite)

## File Structure

```
helios/
├── .env.docker              # Docker Compose environment variables
├── .env.docker.example      # Example file for Docker Compose
├── docker-compose.yml       # Uses variables from .env.docker
├── packages/
│   ├── backend/
│   │   ├── .env            # Backend runtime configuration
│   │   └── .env.example    # Backend example file
│   └── frontend/
│       ├── .env            # Frontend build-time configuration
│       └── .env.example    # Frontend example file
```

## Setup Instructions

### Initial Setup

1. **Copy example files:**
   ```bash
   # Root level - for Docker Compose
   cp .env.docker.example .env.docker
   
   # Backend - for application runtime
   cd packages/backend
   cp .env.example .env
   cd ../..
   
   # Frontend - for build configuration
   cd packages/frontend
   cp .env.example .env
   cd ../..
   ```

2. **Edit `.env.docker`** with your actual values:
   - Add your Supabase project URL and keys
   - Update PostgreSQL password if desired
   - Configure PgAdmin credentials

3. **Edit `packages/backend/.env`**:
   - Add your LLM API key (OpenAI, Anthropic, etc.)
   - Set JWT and session secrets
   - Configure any additional services

4. **Edit `packages/frontend/.env`** (if needed):
   - Update API URL if not using default

### Running with Docker

```bash
# Start all services
npm run docker:up

# View logs
npm run docker:logs

# Stop all services
npm run docker:down
```

## Security Best Practices

1. **Never commit `.env` files** - All `.env` files are in `.gitignore`
2. **Use strong passwords** - Especially for production deployments
3. **Rotate secrets regularly** - Update API keys and secrets periodically
4. **Limit access** - Use environment-specific credentials
5. **Use secrets management** - Consider using a secrets manager for production

## Environment Variable Reference

See the example files for complete variable listings:
- `.env.docker.example` - Docker Compose variables
- `packages/backend/.env.example` - Backend variables
- `packages/frontend/.env` - Frontend variables

## Troubleshooting

### Common Issues

1. **"Cannot connect to database"**
   - Check if PostgreSQL container is running: `docker ps`
   - Verify DATABASE_URL in `.env.docker`
   - Check PostgreSQL logs: `docker-compose logs postgres`

2. **"Supabase features not working"**
   - Verify Supabase credentials in `.env.docker`
   - Check if keys are correctly formatted (no extra spaces)
   - Ensure Supabase project is active

3. **"Environment variable not found"**
   - Make sure you're using the correct `.env` file
   - Restart Docker containers after changing `.env.docker`
   - Rebuild if necessary: `npm run docker:build`
