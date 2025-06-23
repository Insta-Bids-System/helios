#!/usr/bin/env node

// Full Helios System Integration Test
const axios = require('axios');
const io = require('socket.io-client');

const API_URL = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3000';

async function testFullSystem() {
  console.log('🚀 Starting Helios Full System Test\n');

  try {
    // 1. Test Health Check
    console.log('1. Testing Health Check...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅ Health Status:', health.data.status);
    console.log('   Registered Agents:', Object.keys(health.data.agents.byRole).length);

    // 2. Create a Test Project
    console.log('\n2. Creating Test Project...');
    const projectData = {
      name: 'Test Todo App',
      description: 'Build a todo application with React frontend and Express backend with PostgreSQL database'
    };
    
    const project = await axios.post(`${API_URL}/api/projects`, projectData);
    console.log('✅ Project Created:', project.data.projectId);

    // 3. Connect to Socket.io for Real-time Updates
    console.log('\n3. Connecting to WebSocket for real-time updates...');
    const socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
      console.log('✅ WebSocket Connected');
      
      // Join project room
      socket.emit('subscribe', { projectId: project.data.projectId });
    });

    // Listen for agent updates
    socket.on('agentStart', (data) => {
      console.log(`🤖 Agent Started: ${data.agent}`);
    });

    socket.on('stateUpdate', (state) => {
      console.log(`📊 State Update: Active Agent = ${state.active_agent}`);
    });

    socket.on('agentComplete', (data) => {
      console.log(`✅ Agent Completed: ${data.agent}`);
    });

    socket.on('projectComplete', (data) => {
      console.log('\n🎉 Project Completed Successfully!');
      console.log('   Result:', data.result);
      process.exit(0);
    });

    socket.on('projectError', (data) => {
      console.error('\n❌ Project Error:', data.error);
      process.exit(1);
    });

    // Keep the test running for 30 seconds
    setTimeout(() => {
      console.log('\n⏱️ Test timeout reached. Check Docker logs for more details.');
      process.exit(0);
    }, 30000);

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Check if axios and socket.io-client are installed
try {
  require.resolve('axios');
  require.resolve('socket.io-client');
} catch (e) {
  console.log('📦 Installing test dependencies...');
  require('child_process').execSync('npm install axios socket.io-client', { stdio: 'inherit' });
}

// Run the test
testFullSystem();
