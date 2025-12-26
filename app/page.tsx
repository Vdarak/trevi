"use client";

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatInterface } from '@/components/chat/chat-interface';
import { KnowledgeGraph } from '@/components/graph/knowledge-graph';
import { Button } from '@/components/ui/button';
import { Network, MessageSquare } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState<'chat' | 'graph'>('chat');

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-full relative">
        {/* View Toggle (Temporary for demo) */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button 
            variant={view === 'chat' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setView('chat')}
            className="gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </Button>
          <Button 
            variant={view === 'graph' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setView('graph')}
            className="gap-2"
          >
            <Network className="w-4 h-4" />
            Graph
          </Button>
        </div>

        <div className="flex-1 h-full overflow-hidden">
          {view === 'chat' ? (
            <ChatInterface />
          ) : (
            <KnowledgeGraph />
          )}
        </div>
      </main>
    </div>
  );
}
