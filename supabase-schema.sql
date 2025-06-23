-- Create schema for Helios monitoring system
-- This script sets up the necessary tables and views in Supabase

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    graph_data JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    capabilities JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'inactive',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create agent_logs table
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create agent_metrics table
CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    unit VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_logs_project_id ON agent_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_project_id ON agent_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
-- These policies allow the service role to perform all operations

-- Projects policies
CREATE POLICY "Service role can view all projects" ON projects
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role can create projects" ON projects
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update projects" ON projects
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete projects" ON projects
    FOR DELETE USING (auth.role() = 'service_role');

-- Workflows policies
CREATE POLICY "Service role can view all workflows" ON workflows
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role can create workflows" ON workflows
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update workflows" ON workflows
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete workflows" ON workflows
    FOR DELETE USING (auth.role() = 'service_role');

-- Agents policies
CREATE POLICY "Service role can view all agents" ON agents
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role can create agents" ON agents
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update agents" ON agents
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete agents" ON agents
    FOR DELETE USING (auth.role() = 'service_role');

-- Agent logs policies
CREATE POLICY "Service role can view all agent logs" ON agent_logs
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role can create agent logs" ON agent_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Agent metrics policies
CREATE POLICY "Service role can view all agent metrics" ON agent_metrics
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role can create agent metrics" ON agent_metrics
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Insert sample data for testing
INSERT INTO agents (name, role, capabilities, status) VALUES
    ('Web Researcher', 'researcher', '["web_search", "data_extraction", "summarization"]', 'active'),
    ('Code Generator', 'developer', '["code_generation", "debugging", "optimization"]', 'active'),
    ('Data Analyst', 'analyst', '["data_analysis", "visualization", "statistical_modeling"]', 'active'),
    ('Project Manager', 'coordinator', '["task_planning", "resource_allocation", "progress_tracking"]', 'active'),
    ('Quality Checker', 'reviewer', '["code_review", "testing", "validation"]', 'active')
ON CONFLICT DO NOTHING;

-- Create a view for monitoring dashboard
CREATE OR REPLACE VIEW monitoring_dashboard AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.status as project_status,
    COUNT(DISTINCT w.id) as workflow_count,
    COUNT(DISTINCT al.id) as log_count,
    MAX(al.timestamp) as last_activity
FROM projects p
LEFT JOIN workflows w ON p.id = w.project_id
LEFT JOIN agent_logs al ON p.id = al.project_id
GROUP BY p.id, p.name, p.status;

-- Grant access to the view
GRANT SELECT ON monitoring_dashboard TO anon, authenticated;
