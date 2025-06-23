-- Helios Database Schema for Supabase
-- Run this in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/kaeydovooyaxczctsmas/sql/new

-- Note: Supabase uses the public schema by default
-- We'll create tables in public schema but prefix them with helios_

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS helios_agent_logs CASCADE;
DROP TABLE IF EXISTS helios_agent_handoffs CASCADE;
DROP TABLE IF EXISTS helios_artifacts CASCADE;
DROP TABLE IF EXISTS helios_tasks CASCADE;
DROP TABLE IF EXISTS helios_projects CASCADE;

-- =====================================================
-- PROJECTS TABLE
-- =====================================================
CREATE TABLE helios_projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    user_prompt TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT projects_status_check CHECK (
        status IN ('pending', 'initializing', 'planning', 'executing', 'running', 'completed', 'failed', 'cancelled')
    )
);

-- Create indexes
CREATE INDEX idx_helios_projects_status ON helios_projects(status);
CREATE INDEX idx_helios_projects_created_at ON helios_projects(created_at DESC);

-- =====================================================
-- TASKS TABLE  
-- =====================================================
CREATE TABLE helios_tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES helios_projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    assigned_agent VARCHAR(100),
    parent_task_id UUID REFERENCES helios_tasks(id) ON DELETE CASCADE,
    dependencies JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT tasks_status_check CHECK (
        status IN ('pending', 'in_progress', 'completed', 'failed', 'blocked')
    )
);

-- Create indexes
CREATE INDEX idx_helios_tasks_project_id ON helios_tasks(project_id);
CREATE INDEX idx_helios_tasks_status ON helios_tasks(status);
CREATE INDEX idx_helios_tasks_assigned_agent ON helios_tasks(assigned_agent);

-- =====================================================
-- ARTIFACTS TABLE
-- =====================================================
CREATE TABLE helios_artifacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES helios_projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES helios_tasks(id) ON DELETE SET NULL,
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

-- Create indexes
CREATE INDEX idx_helios_artifacts_project_id ON helios_artifacts(project_id);
CREATE INDEX idx_helios_artifacts_is_latest ON helios_artifacts(is_latest) WHERE is_latest = true;

-- =====================================================
-- AGENT_LOGS TABLE
-- =====================================================
CREATE TABLE helios_agent_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES helios_projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES helios_tasks(id) ON DELETE SET NULL,
    agent_role VARCHAR(100) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    log_level VARCHAR(20) DEFAULT 'info',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    error_details JSONB,
    CONSTRAINT agent_logs_level_check CHECK (
        log_level IN ('debug', 'info', 'warn', 'error', 'fatal')
    )
);

-- Create indexes
CREATE INDEX idx_helios_agent_logs_project_id ON helios_agent_logs(project_id);
CREATE INDEX idx_helios_agent_logs_timestamp ON helios_agent_logs(timestamp DESC);

-- =====================================================
-- AGENT_HANDOFFS TABLE
-- =====================================================
CREATE TABLE helios_agent_handoffs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES helios_projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES helios_tasks(id) ON DELETE SET NULL,
    from_agent VARCHAR(100),
    to_agent VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_helios_agent_handoffs_project_id ON helios_agent_handoffs(project_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for projects table
CREATE TRIGGER update_helios_projects_updated_at 
    BEFORE UPDATE ON helios_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to manage artifact versions
CREATE OR REPLACE FUNCTION manage_artifact_versions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_latest = true THEN
        UPDATE helios_artifacts 
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
    AFTER INSERT OR UPDATE ON helios_artifacts
    FOR EACH ROW
    WHEN (NEW.is_latest = true)
    EXECUTE FUNCTION manage_artifact_versions();

-- =====================================================
-- CREATE VIEWS FOR EASIER ACCESS
-- =====================================================

-- Create views that match the original schema names
CREATE OR REPLACE VIEW projects AS SELECT * FROM helios_projects;
CREATE OR REPLACE VIEW tasks AS SELECT * FROM helios_tasks;
CREATE OR REPLACE VIEW artifacts AS SELECT * FROM helios_artifacts;
CREATE OR REPLACE VIEW agent_logs AS SELECT * FROM helios_agent_logs;
CREATE OR REPLACE VIEW agent_handoffs AS SELECT * FROM helios_agent_handoffs;

-- =====================================================
-- ROW LEVEL SECURITY (Optional - for multi-tenant)
-- =====================================================

-- Enable RLS on tables
ALTER TABLE helios_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE helios_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE helios_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE helios_agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE helios_agent_handoffs ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations for now
-- (You can restrict these based on auth.uid() later)
CREATE POLICY "Enable all for projects" ON helios_projects FOR ALL USING (true);
CREATE POLICY "Enable all for tasks" ON helios_tasks FOR ALL USING (true);
CREATE POLICY "Enable all for artifacts" ON helios_artifacts FOR ALL USING (true);
CREATE POLICY "Enable all for agent_logs" ON helios_agent_logs FOR ALL USING (true);
CREATE POLICY "Enable all for agent_handoffs" ON helios_agent_handoffs FOR ALL USING (true);

-- =====================================================
-- ENABLE REALTIME
-- =====================================================

-- Enable realtime for monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE helios_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE helios_agent_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE helios_tasks;

-- =====================================================
-- USEFUL FUNCTIONS
-- =====================================================

-- Function to get agent metrics
CREATE OR REPLACE FUNCTION get_agent_metrics(time_range INTERVAL DEFAULT '1 hour')
RETURNS TABLE(
    agent_role VARCHAR,
    total_actions BIGINT,
    avg_duration_ms NUMERIC,
    error_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.agent_role,
        COUNT(*) as total_actions,
        AVG(al.duration_ms)::NUMERIC as avg_duration_ms,
        SUM(CASE WHEN al.error_details IS NOT NULL THEN 1 ELSE 0 END) as error_count
    FROM helios_agent_logs al
    WHERE al.timestamp > NOW() - time_range
    GROUP BY al.agent_role
    ORDER BY total_actions DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIAL TEST DATA (Optional)
-- =====================================================

-- Insert a test project to verify setup
INSERT INTO helios_projects (name, description, status)
VALUES ('Supabase Setup Test', 'Verifying Supabase integration', 'completed');

-- Get the project ID for reference
DO $$
DECLARE
    test_project_id UUID;
BEGIN
    SELECT id INTO test_project_id FROM helios_projects WHERE name = 'Supabase Setup Test';
    
    -- Insert a test log
    INSERT INTO helios_agent_logs (project_id, agent_role, agent_id, action, details)
    VALUES (test_project_id, 'orchestrator', 'test-orchestrator', 'setup_complete', 
            '{"message": "Supabase schema initialized successfully"}'::JSONB);
    
    RAISE NOTICE 'Test data created. Project ID: %', test_project_id;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Helios schema for Supabase created successfully!';
    RAISE NOTICE 'Tables created with helios_ prefix and views for compatibility';
    RAISE NOTICE 'Real-time enabled for projects, tasks, and agent_logs';
END $$;
