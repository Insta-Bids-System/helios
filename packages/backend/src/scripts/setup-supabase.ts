/**
 * Supabase Setup Script
 * Run this to initialize the Helios schema in your Supabase project
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

console.log('🚀 Initializing Supabase for Helios...');
console.log(`📍 Connecting to: ${supabaseUrl}`);

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function setupSupabase() {
  try {
    // const initSqlPath = path.join(__dirname, '../../sql/init.sql');
    // const initSql = fs.readFileSync(initSqlPath, 'utf8');

    console.log('📝 Note: Please run the init.sql in Supabase SQL Editor for full schema setup');
    console.log('   Go to: https://supabase.com/dashboard/project/kaeydovooyaxczctsmas/sql/new');

    // Test the connection by checking tables
    console.log('\n🔍 Checking existing tables...');
    
    const tables = ['projects', 'tasks', 'artifacts', 'agent_logs', 'agent_handoffs'];
    
    for (const table of tables) {
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.log(`❌ Table '${table}' not found:`, countError.message);
      } else {
        console.log(`✅ Table '${table}' exists (${count || 0} rows)`);
      }
    }

    // Test creating a project
    console.log('\n🧪 Testing project creation...');
    
    const testProject = {
      name: 'Supabase Test Project',
      description: 'Testing Supabase integration',
      status: 'initializing'
    };

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert(testProject)
      .select()
      .single();

    if (projectError) {
      console.log('❌ Could not create test project:', projectError.message);
      console.log('   Please run the init.sql in Supabase SQL Editor first');
    } else {
      console.log('✅ Test project created:', project.id);
      
      // Test real-time subscriptions
      console.log('\n📡 Testing real-time subscriptions...');
      
      const channel = supabase
        .channel('test-channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${project.id}`
          },
          (payload) => {
            console.log('📨 Real-time event received:', payload);
          }
        )
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
        });

      // Update the project to trigger real-time
      setTimeout(async () => {
        const { error: updateError } = await supabase
          .from('projects')
          .update({ status: 'running' })
          .eq('id', project.id);
          
        if (!updateError) {
          console.log('📤 Updated project status to trigger real-time event');
        }
      }, 2000);

      // Give it time to receive the event
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Clean up
      await supabase.removeChannel(channel);
      
      // Delete test project
      await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);
        
      console.log('🧹 Cleaned up test data');
    }

    console.log('\n🎉 Supabase connection test complete!');
    console.log('\n📊 View your database at:');
    console.log(`   https://supabase.com/dashboard/project/kaeydovooyaxczctsmas/editor`);

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the setup
setupSupabase();
