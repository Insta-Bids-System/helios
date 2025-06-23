import { supabase } from '../services/supabase';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...\n');

  try {
    // Test 1: Check if we can connect
    console.log('1. Testing basic connection...');
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .limit(5);

    if (agentsError) {
      console.error('❌ Failed to fetch agents:', agentsError.message);
      return;
    }

    console.log('✅ Successfully connected to Supabase!');
    console.log(`   Found ${agents?.length || 0} agents\n`);

    // Test 2: Create a test project
    console.log('2. Creating test project...');
    const testProject = {
      name: 'Test Monitoring Project',
      description: 'Testing Supabase integration',
      type: 'research',
      status: 'active',
      config: {
        maxAgents: 5,
        timeout: 3600
      }
    };

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert(testProject)
      .select()
      .single();

    if (projectError) {
      console.error('❌ Failed to create project:', projectError.message);
      return;
    }

    console.log('✅ Project created successfully!');
    console.log(`   Project ID: ${project.id}\n`);

    // Test 3: Create a workflow
    console.log('3. Creating test workflow...');
    const testWorkflow = {
      project_id: project.id,
      name: 'Research Workflow',
      graph_data: {
        nodes: [
          { id: '1', type: 'start', position: { x: 100, y: 100 } },
          { id: '2', type: 'research', position: { x: 300, y: 100 } },
          { id: '3', type: 'end', position: { x: 500, y: 100 } }
        ],
        edges: [
          { source: '1', target: '2' },
          { source: '2', target: '3' }
        ]
      },
      status: 'active'
    };

    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .insert(testWorkflow)
      .select()
      .single();

    if (workflowError) {
      console.error('❌ Failed to create workflow:', workflowError.message);
      return;
    }

    console.log('✅ Workflow created successfully!');
    console.log(`   Workflow ID: ${workflow.id}\n`);

    // Test 4: Create some agent logs
    console.log('4. Creating test agent logs...');
    const logs = agents?.slice(0, 3).map((agent, index) => ({
      agent_id: agent.id,
      project_id: project.id,
      workflow_id: workflow.id,
      level: ['info', 'debug', 'warn'][index],
      message: `Test log from ${agent.name}`,
      metadata: {
        task: 'testing',
        duration: Math.random() * 1000
      }
    }));

    if (logs && logs.length > 0) {
      const { error: logsError } = await supabase
        .from('agent_logs')
        .insert(logs);

      if (logsError) {
        console.error('❌ Failed to create logs:', logsError.message);
        return;
      }

      console.log(`✅ Created ${logs.length} test logs!\n`);
    }

    // Test 5: Query monitoring dashboard
    console.log('5. Testing monitoring dashboard view...');
    const { data: dashboard, error: dashboardError } = await supabase
      .from('monitoring_dashboard')
      .select('*')
      .eq('project_id', project.id)
      .single();

    if (dashboardError) {
      console.error('❌ Failed to query dashboard:', dashboardError.message);
      return;
    }

    console.log('✅ Dashboard query successful!');
    console.log('   Dashboard data:', JSON.stringify(dashboard, null, 2));

    // Test 6: Real-time subscription
    console.log('\n6. Testing real-time subscription...');
    const channel = supabase
      .channel('agent-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_logs',
          filter: `project_id=eq.${project.id}`
        },
        (payload) => {
          console.log('📨 Received real-time update:', payload);
        }
      )
      .subscribe();

    console.log('✅ Subscribed to real-time updates!');
    console.log('   Channel status:', channel.state);

    // Insert a log to trigger the subscription
    setTimeout(async () => {
      console.log('\n   Inserting a log to trigger real-time update...');
      await supabase
        .from('agent_logs')
        .insert({
          agent_id: agents[0].id,
          project_id: project.id,
          workflow_id: workflow.id,
          level: 'info',
          message: 'Real-time test message',
          metadata: { realtime: true }
        });
    }, 2000);

    // Cleanup after 5 seconds
    setTimeout(() => {
      console.log('\n🧹 Cleaning up subscriptions...');
      channel.unsubscribe();
      console.log('✅ Test completed successfully!');
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the test
testSupabaseConnection();
