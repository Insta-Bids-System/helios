-- Helios Database Schema
-- Phase 1.2: Persistence Layer Implementation

-- Create helios database schema
CREATE SCHEMA IF NOT EXISTS helios;

-- Set search path
SET search_path TO helios, public;

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROJECTS TABLE
-- Stores high-level project information
-- =====================================================
CREATE TABLE IF NOT EXISTS helios.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,  -- Changed from user_prompt to match code
    user_prompt TEXT,           -- Keep user_prompt as optional field
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT projects_status_check CHECK (
        status IN ('pending', 'initializing', 'planning', 'executing', 'running', 'completed', 'failed', 'cancelled')
    )
);

-- Create index on status for faster queries
CREATE INDEX idx_projects_status ON helios.projects(status);
CREATE INDEX idx_projects_created_at ON helios.projects(created_at DESC);

-- =====================================================
-- TASKS TABLE  
-- Stores individual tasks within a project
-- =====================================================
CREATE TABLE IF NOT EXISTS helios.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES helios.projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    assigned_agent VARCHAR(100),
    parent_task_id UUID REFERENCES helios.tasks(id) ON DELETE CASCADE,
    dependencies JSONB DEFAULT '[]', -- Array of task IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT tasks_status_check CHECK (
        status IN ('pending', 'in_progress', 'completed', 'failed', 'blocked')
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_tasks_project_id ON helios.tasks(project_id);
CREATE INDEX idx_tasks_status ON helios.tasks(status);
CREATE INDEX idx_tasks_assigned_agent ON helios.tasks(assigned_agent);
CREATE INDEX idx_tasks_parent_task_id ON helios.tasks(parent_task_id);

-- =====================================================
-- ARTIFACTS TABLE
-- Stores generated files and content
-- =====================================================
CREATE TABLE IF NOT EXISTS helios.artifacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES helios.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES helios.tasks(id) ON DELETE SET NULL,
    agent_id VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(100) DEFAULT 'text/plain',
    version INTEGER NOT NULL DEFAULT 1,
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT unique_artifact_path_version UNIQUE (project_id, file_path, version)
);

-- Create indexes for artifact queries
CREATE INDEX idx_artifacts_project_id ON helios.artifacts(project_id);
CREATE INDEX idx_artifacts_task_id ON helios.artifacts(task_id);
CREATE INDEX idx_artifacts_file_path ON helios.artifacts(file_path);
CREATE INDEX idx_artifacts_is_latest ON helios.artifacts(is_latest) WHERE is_latest = true;

-- =====================================================
-- AGENT_LOGS TABLE
-- Stores detailed agent execution logs
-- =====================================================
CREATE TABLE IF NOT EXISTS helios.agent_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES helios.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES helios.tasks(id) ON DELETE SET NULL,
    agent_role VARCHAR(100) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',  -- Changed from action_details to match code
    log_level VARCHAR(20) DEFAULT 'info',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    error_details JSONB,
    CONSTRAINT agent_logs_level_check CHECK (
        log_level IN ('debug', 'info', 'warn', 'error', 'fatal')
    )
);

-- Create indexes for log queries
CREATE INDEX idx_agent_logs_project_id ON helios.agent_logs(project_id);
CREATE INDEX idx_agent_logs_task_id ON helios.agent_logs(task_id);
CREATE INDEX idx_agent_logs_agent_role ON helios.agent_logs(agent_role);
CREATE INDEX idx_agent_logs_timestamp ON helios.agent_logs(timestamp DESC);
CREATE INDEX idx_agent_logs_log_level ON helios.agent_logs(log_level);

-- =====================================================
-- AGENT_HANDOFFS TABLE (Additional)
-- Tracks handoffs between agents for debugging
-- =====================================================
CREATE TABLE IF NOT EXISTS helios.agent_handoffs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES helios.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES helios.tasks(id) ON DELETE SET NULL,
    from_agent VARCHAR(100),
    to_agent VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_handoffs_project_id ON helios.agent_handoffs(project_id);
CREATE INDEX idx_agent_handoffs_timestamp ON helios.agent_handoffs(timestamp DESC);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION helios.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for projects table
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON helios.projects
    FOR EACH ROW
    EXECUTE FUNCTION helios.update_updated_at_column();

-- Function to manage artifact versions
CREATE OR REPLACE FUNCTION helios.manage_artifact_versions()
RETURNS TRIGGER AS $$
BEGIN
    -- If inserting a new version, mark all previous versions as not latest
    IF NEW.is_latest = true THEN
        UPDATE helios.artifacts 
        SET is_latest = false 
        WHERE project_id = NEW.project_id 
        AND file_path = NEW.file_path 
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for artifact versioning
CREATE TRIGGER manage_artifact_versions_trigger
    AFTER INSERT OR UPDATE ON helios.artifacts
    FOR EACH ROW
    WHEN (NEW.is_latest = true)
    EXECUTE FUNCTION helios.manage_artifact_versions();

-- =====================================================
-- INITIAL DATA / PERMISSIONS
-- =====================================================

-- Create helios user if it doesn't exist (for local development)
-- Note: In production, user should be created separately
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'helios') THEN
        CREATE USER helios WITH PASSWORD 'helios123';
    END IF;
END
$$;

-- Grant permissions to the helios user
GRANT ALL PRIVILEGES ON SCHEMA helios TO helios;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA helios TO helios;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA helios TO helios;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA helios TO helios;

-- Also grant permissions on public schema for extensions
GRANT USAGE ON SCHEMA public TO helios;
GRANT CREATE ON SCHEMA public TO helios;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE helios.projects IS 'Stores high-level project information initiated by users';
COMMENT ON TABLE helios.tasks IS 'Stores individual tasks decomposed from project requirements';
COMMENT ON TABLE helios.artifacts IS 'Stores all generated files and content with versioning';
COMMENT ON TABLE helios.agent_logs IS 'Detailed execution logs from all agents for debugging and monitoring';
COMMENT ON TABLE helios.agent_handoffs IS 'Tracks control flow between agents for debugging';

COMMENT ON COLUMN helios.projects.description IS 'Project description provided by the user';
COMMENT ON COLUMN helios.projects.user_prompt IS 'Original natural language description from the user (optional)';
COMMENT ON COLUMN helios.tasks.dependencies IS 'JSON array of task IDs that must complete before this task';
COMMENT ON COLUMN helios.artifacts.is_latest IS 'Indicates if this is the most recent version of the file';
COMMENT ON COLUMN helios.agent_logs.details IS 'JSONB containing detailed context about the action';

-- =====================================================
-- USEFUL QUERIES (Commented for reference)
-- =====================================================

-- Get project status summary:
-- SELECT p.id, p.name, p.status, 
--        COUNT(DISTINCT t.id) as total_tasks,
--        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') as completed_tasks
-- FROM helios.projects p
-- LEFT JOIN helios.tasks t ON p.id = t.project_id
-- GROUP BY p.id, p.name, p.status;

-- Get recent agent activity:
-- SELECT agent_role, COUNT(*) as action_count, 
--        AVG(duration_ms) as avg_duration_ms
-- FROM helios.agent_logs
-- WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
-- GROUP BY agent_role
-- ORDER BY action_count DESC;

-- Find artifacts for a project:
-- SELECT file_path, version, created_at, agent_id
-- FROM helios.artifacts
-- WHERE project_id = ? AND is_latest = true
-- ORDER BY file_path;
