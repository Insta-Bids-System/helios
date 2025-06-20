-- Helios Generative Agent Swarm Database Schema
-- Version: 1.0
-- Date: June 20, 2025
-- Description: Complete database schema for the Helios multi-agent system

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create helios schema for better organization
CREATE SCHEMA IF NOT EXISTS helios;

-- Set search path to include helios schema
SET search_path TO helios, public;

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS helios.agent_logs CASCADE;
DROP TABLE IF EXISTS helios.artifacts CASCADE;
DROP TABLE IF EXISTS helios.tasks CASCADE;
DROP TABLE IF EXISTS helios.projects CASCADE;

-- =====================================================
-- PROJECTS TABLE
-- =====================================================
-- Core table storing project information and user prompts
CREATE TABLE helios.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    user_prompt TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT chk_project_status CHECK (status IN ('pending', 'planning', 'in_progress', 'completed', 'failed', 'cancelled'))
);

-- Create indexes for projects table
CREATE INDEX idx_projects_status ON helios.projects(status);
CREATE INDEX idx_projects_created_at ON helios.projects(created_at DESC);
CREATE INDEX idx_projects_name ON helios.projects(name);

-- Add comments for documentation
COMMENT ON TABLE helios.projects IS 'Stores all projects initiated by users with their prompts and execution status';
COMMENT ON COLUMN helios.projects.id IS 'Unique identifier for the project';
COMMENT ON COLUMN helios.projects.name IS 'Human-readable name for the project';
COMMENT ON COLUMN helios.projects.user_prompt IS 'Original user prompt that initiated the project';
COMMENT ON COLUMN helios.projects.status IS 'Current status of the project execution';
COMMENT ON COLUMN helios.projects.metadata IS 'Additional project metadata in JSON format';

-- =====================================================
-- TASKS TABLE
-- =====================================================
-- Stores individual tasks generated for each project
CREATE TABLE helios.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    dependencies UUID[] DEFAULT ARRAY[]::UUID[],
    assigned_agent VARCHAR(100),
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result JSONB,
    
    -- Foreign key constraint
    CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) 
        REFERENCES helios.projects(id) ON DELETE CASCADE,
    
    -- Status constraint
    CONSTRAINT chk_task_status CHECK (status IN ('pending', 'queued', 'in_progress', 'completed', 'failed', 'cancelled'))
);

-- Create indexes for tasks table
CREATE INDEX idx_tasks_project_id ON helios.tasks(project_id);
CREATE INDEX idx_tasks_status ON helios.tasks(status);
CREATE INDEX idx_tasks_created_at ON helios.tasks(created_at DESC);
CREATE INDEX idx_tasks_dependencies ON helios.tasks USING GIN(dependencies);
CREATE INDEX idx_tasks_assigned_agent ON helios.tasks(assigned_agent);

-- Add comments for tasks table
COMMENT ON TABLE helios.tasks IS 'Stores individual tasks decomposed from project requirements';
COMMENT ON COLUMN helios.tasks.id IS 'Unique identifier for the task';
COMMENT ON COLUMN helios.tasks.project_id IS 'Reference to the parent project';
COMMENT ON COLUMN helios.tasks.description IS 'Detailed description of what the task accomplishes';
COMMENT ON COLUMN helios.tasks.status IS 'Current execution status of the task';
COMMENT ON COLUMN helios.tasks.dependencies IS 'Array of task IDs that must complete before this task';
COMMENT ON COLUMN helios.tasks.assigned_agent IS 'Name/type of the agent assigned to execute this task';
COMMENT ON COLUMN helios.tasks.priority IS 'Task priority for scheduling (higher number = higher priority)';
COMMENT ON COLUMN helios.tasks.result IS 'JSON result data from task execution';

-- =====================================================
-- ARTIFACTS TABLE
-- =====================================================
-- Stores generated artifacts (files, code, documents)
CREATE TABLE helios.artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    task_id UUID,
    file_path VARCHAR(500) NOT NULL,
    content TEXT,
    content_type VARCHAR(100),
    file_size BIGINT,
    version INTEGER NOT NULL DEFAULT 1,
    is_latest BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    
    -- Foreign key constraints
    CONSTRAINT fk_artifacts_project FOREIGN KEY (project_id) 
        REFERENCES helios.projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_artifacts_task FOREIGN KEY (task_id) 
        REFERENCES helios.tasks(id) ON DELETE SET NULL,
    
    -- Unique constraint for versioning
    CONSTRAINT uq_artifact_path_version UNIQUE (project_id, file_path, version)
);

-- Create indexes for artifacts table
CREATE INDEX idx_artifacts_project_id ON helios.artifacts(project_id);
CREATE INDEX idx_artifacts_task_id ON helios.artifacts(task_id);
CREATE INDEX idx_artifacts_file_path ON helios.artifacts(file_path);
CREATE INDEX idx_artifacts_created_at ON helios.artifacts(created_at DESC);
CREATE INDEX idx_artifacts_is_latest ON helios.artifacts(is_latest) WHERE is_latest = TRUE;

-- Add comments for artifacts table
COMMENT ON TABLE helios.artifacts IS 'Stores all generated artifacts including code files, documents, and other outputs';
COMMENT ON COLUMN helios.artifacts.id IS 'Unique identifier for the artifact';
COMMENT ON COLUMN helios.artifacts.project_id IS 'Reference to the parent project';
COMMENT ON COLUMN helios.artifacts.task_id IS 'Reference to the task that generated this artifact';
COMMENT ON COLUMN helios.artifacts.file_path IS 'Relative path of the file within the project';
COMMENT ON COLUMN helios.artifacts.content IS 'Actual content of the artifact';
COMMENT ON COLUMN helios.artifacts.content_type IS 'MIME type of the artifact';
COMMENT ON COLUMN helios.artifacts.version IS 'Version number for tracking changes';
COMMENT ON COLUMN helios.artifacts.is_latest IS 'Flag indicating if this is the current version';
COMMENT ON COLUMN helios.artifacts.metadata IS 'Additional metadata like file permissions, encoding, etc.';

-- =====================================================
-- AGENT_LOGS TABLE
-- =====================================================
-- Stores detailed logs of agent actions and decisions
CREATE TABLE helios.agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    task_id UUID,
    agent_role VARCHAR(100) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    action_details JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_details JSONB,
    
    -- Foreign key constraints
    CONSTRAINT fk_agent_logs_project FOREIGN KEY (project_id) 
        REFERENCES helios.projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_logs_task FOREIGN KEY (task_id) 
        REFERENCES helios.tasks(id) ON DELETE SET NULL
);

-- Create indexes for agent_logs table
CREATE INDEX idx_agent_logs_project_id ON helios.agent_logs(project_id);
CREATE INDEX idx_agent_logs_task_id ON helios.agent_logs(task_id);
CREATE INDEX idx_agent_logs_agent_role ON helios.agent_logs(agent_role);
CREATE INDEX idx_agent_logs_timestamp ON helios.agent_logs(timestamp DESC);
CREATE INDEX idx_agent_logs_action_type ON helios.agent_logs(action_type);
CREATE INDEX idx_agent_logs_action_details ON helios.agent_logs USING GIN(action_details);

-- Add comments for agent_logs table
COMMENT ON TABLE helios.agent_logs IS 'Comprehensive logging of all agent actions and decisions';
COMMENT ON COLUMN helios.agent_logs.id IS 'Unique identifier for the log entry';
COMMENT ON COLUMN helios.agent_logs.project_id IS 'Reference to the parent project';
COMMENT ON COLUMN helios.agent_logs.task_id IS 'Reference to the associated task (if applicable)';
COMMENT ON COLUMN helios.agent_logs.agent_role IS 'Role/type of the agent that performed the action';
COMMENT ON COLUMN helios.agent_logs.action_type IS 'Type of action performed (e.g., analyze, generate, validate)';
COMMENT ON COLUMN helios.agent_logs.action_details IS 'Detailed JSON data about the action';
COMMENT ON COLUMN helios.agent_logs.timestamp IS 'When the action occurred';
COMMENT ON COLUMN helios.agent_logs.duration_ms IS 'How long the action took in milliseconds';
COMMENT ON COLUMN helios.agent_logs.success IS 'Whether the action completed successfully';
COMMENT ON COLUMN helios.agent_logs.error_details IS 'Error information if the action failed';

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION helios.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for projects table
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON helios.projects
    FOR EACH ROW 
    EXECUTE FUNCTION helios.update_updated_at_column();

-- Function to manage artifact versioning
CREATE OR REPLACE FUNCTION helios.manage_artifact_versions()
RETURNS TRIGGER AS $$
BEGIN
    -- If inserting a new version, mark all previous versions as not latest
    IF NEW.is_latest = TRUE THEN
        UPDATE helios.artifacts 
        SET is_latest = FALSE 
        WHERE project_id = NEW.project_id 
          AND file_path = NEW.file_path 
          AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for artifact versioning
CREATE TRIGGER manage_artifact_versions_trigger
    AFTER INSERT OR UPDATE ON helios.artifacts
    FOR EACH ROW
    EXECUTE FUNCTION helios.manage_artifact_versions();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active projects with task counts
CREATE OR REPLACE VIEW helios.v_active_projects AS
SELECT 
    p.id,
    p.name,
    p.status,
    p.created_at,
    COUNT(DISTINCT t.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'failed' THEN t.id END) as failed_tasks,
    COUNT(DISTINCT a.id) as total_artifacts
FROM helios.projects p
LEFT JOIN helios.tasks t ON p.id = t.project_id
LEFT JOIN helios.artifacts a ON p.id = a.project_id AND a.is_latest = TRUE
WHERE p.status NOT IN ('completed', 'cancelled')
GROUP BY p.id, p.name, p.status, p.created_at;

-- View for task dependencies
CREATE OR REPLACE VIEW helios.v_task_dependencies AS
SELECT 
    t.id as task_id,
    t.description as task_description,
    t.status as task_status,
    d.dependency_id,
    dt.description as dependency_description,
    dt.status as dependency_status
FROM helios.tasks t
CROSS JOIN LATERAL unnest(t.dependencies) as d(dependency_id)
JOIN helios.tasks dt ON dt.id = d.dependency_id;

-- =====================================================
-- INITIAL DATA (Optional)
-- =====================================================

-- Insert sample agent roles for reference
INSERT INTO helios.agent_logs (project_id, agent_role, action_type, action_details)
SELECT 
    uuid_generate_v4(), 
    'system', 
    'initialization', 
    jsonb_build_object(
        'message', 'Database schema initialized',
        'version', '1.0',
        'agent_roles', ARRAY[
            'orchestrator',
            'project_analyzer',
            'task_decomposer',
            'code_generator',
            'documentation_writer',
            'test_generator',
            'validator',
            'deployment_agent'
        ]
    )
WHERE NOT EXISTS (
    SELECT 1 FROM helios.agent_logs 
    WHERE agent_role = 'system' 
    AND action_type = 'initialization'
);

-- =====================================================
-- PERMISSIONS (Adjust based on your needs)
-- =====================================================

-- Grant permissions to the application user (replace 'helios_app' with your actual user)
-- GRANT ALL ON SCHEMA helios TO helios_app;
-- GRANT ALL ON ALL TABLES IN SCHEMA helios TO helios_app;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA helios TO helios_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA helios TO helios_app;

-- =====================================================
-- PERFORMANCE NOTES
-- =====================================================
-- 1. All primary keys use UUID for distributed system compatibility
-- 2. JSONB columns are indexed with GIN for fast queries
-- 3. Timestamp columns are indexed DESC for recent data access
-- 4. Foreign keys have CASCADE DELETE for data integrity
-- 5. Views are created for common query patterns
-- 6. Triggers manage automatic timestamp updates and versioning

-- End of schema creation
