import React from 'react';
import Image from 'next/image';
import { BookOpen, MessageSquare, Plus, Search, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, ...props }: SidebarProps) {
  return (
    <div className={cn("w-64 border-r border-slate-200 bg-slate-50/40 h-screen flex flex-col", className)} {...props}>
      <div className="px-6 py-6 flex items-center gap-2">
        <Image src="/logo.svg" alt="Trevi Logo" width={32} height={32} className="dark:invert" />
        <span className="text-xl font-bold tracking-tight text-slate-900">trevi</span>
      </div>
      
      <div className="px-6 mb-6">
        <p className="text-sm text-slate-500 mb-4">
          explore your <span className="text-blue-500 font-semibold">curiosity.</span>
        </p>
      </div>

      <div className="space-y-4 py-4 flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight flex items-center gap-2 text-slate-800">
            <MessageSquare className="w-4 h-4" />
            Chats
          </h2>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start font-normal text-slate-700">
              What is consciousness?
            </Button>
            <Button variant="ghost" className="w-full justify-start font-normal text-slate-700">
              Explain quantum entanglement
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white">
            <User className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-800">ByeWind</span>
            <span className="text-xs text-slate-500">Free Plan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
