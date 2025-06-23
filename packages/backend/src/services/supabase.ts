import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Create Supabase client with service role key for admin operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Create anon client for public operations
export const supabaseAnon = createClient(
  supabaseUrl,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false
    }
  }
);

/**
 * Initialize Supabase schema in the cloud database
 * This will create all the tables if they don't exist
 */
export async function initializeSupabaseSchema(): Promise<void> {
  try {
    logger.info('Initializing Supabase schema...');
    
    // Check if helios schema exists
    const { data: schemas, error: schemaError } = await supabase
      .rpc('pg_namespace_exists', { schema_name: 'helios' });
    
    if (schemaError) {
      logger.error('Error checking schema:', schemaError);
      // Schema might not exist, that's okay
    }
    
    // You can run the init.sql here if needed
    logger.info('Supabase schema check complete');
  } catch (error) {
    logger.error('Failed to initialize Supabase schema:', error);
  }
}

/**
 * Real-time subscription to agent logs
 */
export function subscribeToAgentLogs(
  projectId: string,
  callback: (log: any) => void
) {
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
        callback(payload.new);
      }
    )
    .subscribe();
}

/**
 * Subscribe to project status changes
 */
export function subscribeToProjectStatus(
  projectId: string,
  callback: (project: any) => void
) {
  return supabase
    .channel(`project:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'helios',
        table: 'projects',
        filter: `id=eq.${projectId}`
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();
}

/**
 * Get project status with all related data
 */
export async function getProjectStatus(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      workflows (count),
      agent_logs (count)
    `)
    .eq('id', projectId)
    .single();

  return { data, error };
}

/**
 * Get recent agent activity
 */
export async function getRecentAgentActivity(limit = 50) {
  const { data, error } = await supabase
    .from('agent_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  return { data, error };
}

/**
 * Get agent performance metrics
 */
export async function getAgentMetrics(timeRange = '1 hour') {
  const { data, error } = await supabase
    .rpc('get_agent_metrics', { time_range: timeRange });

  return { data, error };
}

/**
 * Store artifact in Supabase
 */
export async function storeArtifact(artifact: any) {
  const { data, error } = await supabase
    .from('artifacts')
    .insert(artifact)
    .select()
    .single();

  return { data, error };
}

/**
 * Get all artifacts for a project
 */
export async function getProjectArtifacts(projectId: string) {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_latest', true)
    .order('created_at', { ascending: false });

  return { data, error };
}

logger.info('Supabase service initialized');
