# Supabase Setup Instructions

## 1. Run the Schema Script

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/kaeydovooyaxczctsmas
2. Navigate to the SQL Editor (in the left sidebar)
3. Click "New Query"
4. Copy the entire contents of `supabase-schema.sql` 
5. Paste it into the SQL editor
6. Click "Run" (or press Ctrl+Enter)

You should see a success message indicating the tables and policies were created.

## 2. Verify the Setup

After running the schema, you can verify everything was created correctly:

1. Go to the Table Editor in Supabase
2. You should see these tables:
   - `projects`
   - `workflows`
   - `agents` (with 5 sample agents)
   - `agent_logs`
   - `agent_metrics`

3. Check the Database section for the view:
   - `monitoring_dashboard`

## 3. Test the Connection

Once the schema is set up, run the test script from the backend container:

```bash
docker exec -it helios-backend npx tsx src/scripts/test-supabase.ts
```

This will:
- Test the connection
- Create a test project
- Create a workflow
- Insert some logs
- Test real-time subscriptions

## 4. Access Monitoring Endpoints

After setup, you can access these endpoints:

- Health Check: http://localhost:3000/api/health
- Monitor Agents: http://localhost:3000/api/monitor/agents
- Project Monitor: http://localhost:3000/api/projects/{project-id}/monitor

## Notes

- The schema includes Row Level Security (RLS) policies
- All tables have `updated_at` triggers
- The service role key has full access to all tables
- Real-time is enabled for agent logs
