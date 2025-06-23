import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatInterface from './components/ChatInterface';
import ProjectCanvas from './components/ProjectCanvas';
import Sidebar from './components/Sidebar';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex h-screen bg-gray-950 text-white">
          {/* Sidebar with project list */}
          <Sidebar 
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
          />
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Helios AI Development Platform
              </h1>
            </header>
            
            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Project Canvas - 2/3 width */}
              <div className="flex-1 bg-gray-900 p-6 overflow-auto">
                <ProjectCanvas projectId={selectedProjectId} />
              </div>
              
              {/* Chat Interface - 1/3 width */}
              <div className="w-96 bg-gray-950 border-l border-gray-800">
                <ChatInterface 
                  onProjectCreated={(projectId) => setSelectedProjectId(projectId)}
                  selectedProjectId={selectedProjectId}
                />
              </div>
            </div>
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
