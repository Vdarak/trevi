"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getChats, formatRelativeTime, type Chat } from '@/lib/api';
import { FeedbackModal, FeedbackButton } from '@/components/feedback/feedback-modal';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedChatId?: string | null;
  onChatSelect?: (chatId: string) => void;
  onNewChat?: () => void;
  onLogoClick?: () => void;
}

export function Sidebar({
  className,
  selectedChatId,
  onChatSelect,
  onNewChat,
  onLogoClick,
  ...props
}: SidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const fetchChats = async () => {
    try {
      const response = await getChats();
      setChats(response.chats);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  // Refresh chats when a new chat might have been created
  useEffect(() => {
    if (selectedChatId) {
      fetchChats();
    }
  }, [selectedChatId]);

  return (
    <div className={cn("w-64 border-r border-slate-200 bg-slate-50/40 h-screen flex flex-col", className)} {...props}>
      {/* Logo - clickable to go home */}
      <div
        className="px-6 py-6 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onLogoClick}
      >
        <Image src="/logo.svg" alt="Trevi Logo" width={32} height={32} className="dark:invert" />
        <span className="text-xl font-bold tracking-tight text-slate-900">trevi</span>
      </div>

      <div className="px-6 mb-4">
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
            {loading ? (
              <p className="px-4 text-sm text-slate-400">Loading...</p>
            ) : chats.length === 0 ? (
              <p className="px-4 text-sm text-slate-400">No chats yet</p>
            ) : (
              chats.map((chat) => (
                <Button
                  key={chat.chat_id}
                  variant={selectedChatId === chat.chat_id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start font-normal h-auto py-2 text-left",
                    selectedChatId === chat.chat_id && "bg-slate-200"
                  )}
                  onClick={() => onChatSelect?.(chat.chat_id)}
                >
                  <div className="flex flex-col items-start w-full">
                    <span className="text-sm text-slate-700 truncate w-full">
                      {chat.chat_name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(chat.created_at)}
                    </span>
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 border-t border-slate-200">
        <FeedbackButton onClick={() => setIsFeedbackOpen(true)} />
      </div>

      {/* Feedback Modal */}
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
