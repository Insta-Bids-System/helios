# Supabase Integration Setup for Helios

This guide explains how to integrate Supabase with the existing Helios PostgreSQL database for easier monitoring and management.

## Quick Setup: pgAdmin for Immediate Database UI

Since you already have PostgreSQL running, let's add pgAdmin for immediate database visibility:

### 1. Update docker-compose.yml

Add this service to your `docker-compose.yml`:

```yaml
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: helios-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@helios.local
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "5050:80"
    depends_on:
      - postgres
    volumes:
      - pgadmin-data:/var/lib/pgadmin

volumes:
  pgadmin-data:
```

### 2. Start pgAdmin

```bash
docker-compose up -d pgadmin
```

### 3. Access pgAdmin

1. Open http://localhost:5050
2. Login with:
   - Email: admin@helios.local
   - Password: admin
3. Add a new server:
   - Name: Helios Database
   - Host: postgres
   - Port: 5432
   - Database: helios_db
   - Username: helios
   - Password: helios123

Now you can browse and query your database visually!

## Full Supabase Integration (Optional)

For more advanced features like real-time subscriptions and automatic REST APIs:

### Option 1: Supabase Cloud (Easiest)

1. Sign up at https://supabase.com (free tier available)
2. Create a new project
3. In SQL Editor, run your init.sql
4. Update backend to use Supabase connection

### Option 2: Local Supabase with Docker

Create `supabase-docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    container_name: supabase-postgres
    image: supabase/postgres:15.1.0.117
    healthcheck:
      test: pg_isready -U postgres -h localhost
      interval: 5s
      timeout: 5s
      retries: 10
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
    restart: unless-stopped
    ports:
      - 54322:5432
    environment:
      POSTGRES_PASSWORD: your-super-secret-password
    volumes:
      - supabase-db-data:/var/lib/postgresql/data
      - ./packages/backend/sql/init.sql:/docker-entrypoint-initdb.d/init.sql

  studio:
    container_name: supabase-studio
    image: supabase/studio:20240101.01.01
    restart: unless-stopped
    ports:
      - 54323:3000
    environment:
      POSTGRES_PASSWORD: your-super-secret-password
      DEFAULT_ORGANIZATION_NAME: Helios
      DEFAULT_PROJECT_NAME: Helios Agent Swarm
      SUPABASE_URL: http://kong:8000
      SUPABASE_PUBLIC_URL: http://localhost:54321
      STUDIO_PG_META_URL: http://postgres-meta:8080

  kong:
    container_name: supabase-kong
    image: kong:2.8.1
    restart: unless-stopped
    ports:
      - 54321:8000
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl

volumes:
  supabase-db-data:
```

### Option 3: Connect Supabase Client to Existing Database

Install Supabase client:

```bash
cd packages/backend
npm install @supabase/supabase-js
```

Create `packages/backend/src/services/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database.types'

// Connect to your existing PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://helios:helios123@localhost:5432/helios_db'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlbGlvcyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2MjM5MDIyLCJleHAiOjE5NjE4MTUwMjJ9.your-secret-key'

export const supabase = createClient<Database>(
  'http://localhost:54321', // Or your Supabase project URL
  ANON_KEY,
  {
    db: {
      schema: 'helios'
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
)

// Example: Real-time subscription to agent logs
export function subscribeToAgentLogs(projectId: string, callback: (log: any) => void) {
  return supabase
    .channel(`agent-logs:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'helios',
        table: 'agent_logs',
        filter: `project_id=eq.${projectId}`
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()
}

// Example: Query helpers
export async function getProjectStatus(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      tasks (count),
      artifacts (count),
      agent_logs (count)
    `)
    .eq('id', projectId)
    .single()

  return { data, error }
}

export async function getRecentAgentActivity(limit = 50) {
  const { data, error } = await supabase
    .from('agent_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)

  return { data, error }
}
```

## Generate TypeScript Types from Database

```bash
npx supabase gen types typescript --project-id helios --schema helios > packages/backend/src/types/database.types.ts
```

## Benefits of Each Approach

### pgAdmin (Immediate Solution)
- ✅ Works with existing setup
- ✅ No code changes needed
- ✅ Full SQL query capabilities
- ✅ Visual table browser
- ❌ No real-time features

### Supabase Integration
- ✅ Real-time subscriptions
- ✅ Automatic REST API
- ✅ Row Level Security
- ✅ TypeScript type generation
- ✅ Built-in authentication
- ❌ Requires setup time

## Monitoring Queries

Once you have database access, here are useful queries for monitoring:

```sql
-- Current project status
SELECT 
  p.*,
  COUNT(DISTINCT t.id) as task_count,
  COUNT(DISTINCT a.id) as artifact_count,
  COUNT(DISTINCT al.id) as log_count
FROM helios.projects p
LEFT JOIN helios.tasks t ON p.id = t.project_id
LEFT JOIN helios.artifacts a ON p.id = a.project_id
LEFT JOIN helios.agent_logs al ON p.id = al.project_id
GROUP BY p.id;

-- Recent agent activity
SELECT 
  agent_role,
  action,
  details,
  timestamp
FROM helios.agent_logs
ORDER BY timestamp DESC
LIMIT 20;

-- Agent performance metrics
SELECT 
  agent_role,
  COUNT(*) as action_count,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration
FROM helios.agent_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY agent_role;
```
