# Helios Database Monitoring with pgAdmin

pgAdmin is now running at: http://localhost:5050

## Login Credentials
- **Email**: admin@example.com
- **Password**: admin

## Add Database Connection

1. Open http://localhost:5050 in your browser
2. Login with the credentials above
3. Right-click on "Servers" → "Register" → "Server"
4. Fill in the following:

### General Tab:
- **Name**: Helios Database

### Connection Tab:
- **Host**: postgres (use the container name, not localhost)
- **Port**: 5432
- **Database**: helios_db
- **Username**: helios
- **Password**: helios123

Click "Save" and you'll be connected!

## Useful Queries to Monitor Your System

### 1. View All Projects
```sql
SELECT * FROM helios.projects ORDER BY created_at DESC;
```

### 2. Current Project Status Dashboard
```sql
SELECT 
    p.id,
    p.name,
    p.status,
    p.created_at,
    COUNT(DISTINCT t.id) as task_count,
    COUNT(DISTINCT a.id) as artifact_count,
    COUNT(DISTINCT al.id) as log_count,
    MAX(al.timestamp) as last_activity
FROM helios.projects p
LEFT JOIN helios.tasks t ON p.id = t.project_id
LEFT JOIN helios.artifacts a ON p.id = a.project_id
LEFT JOIN helios.agent_logs al ON p.id = al.project_id
GROUP BY p.id, p.name, p.status, p.created_at
ORDER BY p.created_at DESC;
```

### 3. Real-time Agent Activity
```sql
SELECT 
    timestamp,
    agent_role,
    action,
    details,
    duration_ms
FROM helios.agent_logs
ORDER BY timestamp DESC
LIMIT 50;
```

### 4. Agent Performance Metrics
```sql
SELECT 
    agent_role,
    COUNT(*) as total_actions,
    AVG(duration_ms) as avg_duration_ms,
    MIN(duration_ms) as min_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    SUM(CASE WHEN error_details IS NOT NULL THEN 1 ELSE 0 END) as error_count
FROM helios.agent_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY agent_role
ORDER BY total_actions DESC;
```

### 5. Task Progress by Project
```sql
SELECT 
    p.name as project_name,
    t.title as task_title,
    t.status,
    t.assigned_agent,
    t.created_at,
    t.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.created_at))/60 as duration_minutes
FROM helios.tasks t
JOIN helios.projects p ON t.project_id = p.id
ORDER BY t.created_at DESC;
```

### 6. Generated Artifacts
```sql
SELECT 
    p.name as project_name,
    a.file_path,
    a.content_type,
    a.version,
    a.created_at,
    LENGTH(a.content) as content_size
FROM helios.artifacts a
JOIN helios.projects p ON a.project_id = p.id
WHERE a.is_latest = true
ORDER BY a.created_at DESC;
```

### 7. Agent Handoff Flow
```sql
SELECT 
    timestamp,
    from_agent,
    to_agent,
    reason
FROM helios.agent_handoffs
ORDER BY timestamp DESC
LIMIT 20;
```

## Creating Views for Easy Monitoring

You can create these views in pgAdmin for quick access:

```sql
-- Project Dashboard View
CREATE OR REPLACE VIEW helios.v_project_dashboard AS
SELECT 
    p.id,
    p.name,
    p.status,
    p.created_at,
    COUNT(DISTINCT t.id) as task_count,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
    COUNT(DISTINCT a.id) as artifact_count,
    COUNT(DISTINCT al.id) as log_count,
    MAX(al.timestamp) as last_activity
FROM helios.projects p
LEFT JOIN helios.tasks t ON p.id = t.project_id
LEFT JOIN helios.artifacts a ON p.id = a.project_id
LEFT JOIN helios.agent_logs al ON p.id = al.project_id
GROUP BY p.id, p.name, p.status, p.created_at;

-- Agent Activity View
CREATE OR REPLACE VIEW helios.v_agent_activity AS
SELECT 
    DATE_TRUNC('minute', timestamp) as minute,
    agent_role,
    COUNT(*) as actions_per_minute,
    AVG(duration_ms) as avg_duration_ms
FROM helios.agent_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY DATE_TRUNC('minute', timestamp), agent_role
ORDER BY minute DESC, agent_role;
```

## Troubleshooting

If you can't connect to the database:
1. Make sure all Docker containers are running: `docker-compose ps`
2. Check if postgres container is healthy: `docker logs helios-postgres`
3. Try using the container IP instead of hostname: `docker inspect helios-postgres | grep IPAddress`

## Next Steps

For more advanced monitoring and real-time features, consider:
1. Setting up Supabase for real-time subscriptions
2. Creating a custom dashboard in the frontend
3. Adding Grafana for time-series monitoring
