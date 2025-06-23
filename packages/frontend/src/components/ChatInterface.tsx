import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { projectApi, CreateProjectRequest } from '../services/api';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onProjectCreated: (projectId: string) => void;
  selectedProjectId: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onProjectCreated, selectedProjectId }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! I\'m Helios. Tell me what you\'d like to build and I\'ll help you create it.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const createProjectMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: (project) => {
      onProjectCreated(project.id);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `✅ Project "${project.name}" created! I'm now orchestrating the agents to build your application.`,
        timestamp: new Date(),
      }]);
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `❌ Error creating project: ${error.message}`,
        timestamp: new Date(),
      }]);
    },
  });

  const parseProjectRequest = (message: string): CreateProjectRequest | null => {
    // Simple parsing - in real implementation, this would use NLP
    const nameMatch = message.match(/(?:create|build|make)\s+(?:a|an)?\s*(.+?)(?:\.|$)/i);
    
    if (nameMatch) {
      return {
        name: nameMatch[1].trim(),
        description: message,
        requirements: [message], // In real implementation, extract specific requirements
      };
    }
    
    return null;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Parse the message for project creation intent
    const projectRequest = parseProjectRequest(input);
    
    if (projectRequest) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I understand you want to ${projectRequest.name}. Let me create that project for you...`,
        timestamp: new Date(),
      }]);
      
      createProjectMutation.mutate(projectRequest);
    } else {
      // Handle other types of messages
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I can help you create projects. Try saying something like "Create a todo app" or "Build a weather dashboard".',
        timestamp: new Date(),
      }]);
    }

    setInput('');
  };
  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-gray-900 px-4 py-3 border-b border-gray-800">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <p className="text-sm text-gray-400">Describe what you want to build</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.type === 'user'
                  ? 'bg-orange-600 text-white'
                  : message.type === 'assistant'
                  ? 'bg-gray-800 text-gray-100'
                  : 'bg-blue-900/30 text-blue-300 border border-blue-800'
              }`}
            >
              <div className="flex items-start gap-2">
                {message.type === 'assistant' && <Bot size={16} className="mt-0.5" />}
                {message.type === 'user' && <User size={16} className="mt-0.5" />}
                <div>
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-50 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="What would you like to build?"
            className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || createProjectMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;