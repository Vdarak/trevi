import React from 'react';
import { Mic, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export function ChatInterface() {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto px-4 w-full">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-slate-900">Ask Anything</h1>
        <p className="text-slate-500 text-lg">
          Research on any topics or brainstorm ideas.
        </p>
      </div>

      <div className="w-full relative mb-8">
        <Input 
          placeholder="Start typing..." 
          className="h-14 pl-6 pr-24 rounded-full shadow-sm border-slate-200 text-lg text-slate-900"
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <Button size="icon" variant="ghost" className="rounded-full text-slate-500 hover:text-slate-900">
            <Mic className="w-5 h-5" />
          </Button>
          <Button size="icon" className="rounded-full bg-slate-900 hover:bg-slate-800">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        <Card className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-slate-200 shadow-none">
          <p className="text-sm font-medium text-slate-700">What will be the weather tomorrow</p>
        </Card>
        <Card className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-slate-200 shadow-none">
          <p className="text-sm font-medium text-slate-700">How does rocket ships work in general</p>
        </Card>
        <Card className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-slate-200 shadow-none">
          <p className="text-sm font-medium text-slate-700">Corresponding grammatical structure</p>
        </Card>
      </div>
    </div>
  );
}
