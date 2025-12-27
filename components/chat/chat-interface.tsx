"use client";

import React, { useState } from 'react';
import { Mic, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  statusMessage?: string;
}

export function ChatInterface({ onSendMessage, isLoading, statusMessage }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      onSendMessage(suggestion);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto px-4 w-full">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-slate-900">Ask Anything</h1>
        <p className="text-slate-500 text-lg">
          Research on any topics or brainstorm ideas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full relative mb-8">
        <Input 
          placeholder="Start typing..." 
          className="h-14 pl-6 pr-24 rounded-full shadow-sm border-slate-200 text-lg text-slate-900"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <Button 
            type="button"
            size="icon" 
            variant="ghost" 
            className="rounded-full text-slate-500 hover:text-slate-900"
            disabled={isLoading}
          >
            <Mic className="w-5 h-5" />
          </Button>
          <Button 
            type="submit"
            size="icon" 
            className="rounded-full bg-slate-900 hover:bg-slate-800"
            disabled={isLoading || !message.trim()}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Status Message */}
      {isLoading && statusMessage && (
        <div className="mb-8 flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* Suggestions */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <Card 
            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-slate-200 shadow-none"
            onClick={() => handleSuggestionClick("What will be the weather tomorrow")}
          >
            <p className="text-sm font-medium text-slate-700">What will be the weather tomorrow</p>
          </Card>
          <Card 
            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-slate-200 shadow-none"
            onClick={() => handleSuggestionClick("How does rocket ships work in general")}
          >
            <p className="text-sm font-medium text-slate-700">How does rocket ships work in general</p>
          </Card>
          <Card 
            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-slate-200 shadow-none"
            onClick={() => handleSuggestionClick("Corresponding grammatical structure")}
          >
            <p className="text-sm font-medium text-slate-700">Corresponding grammatical structure</p>
          </Card>
        </div>
      )}
    </div>
  );
}
