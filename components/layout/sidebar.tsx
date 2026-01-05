"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getChats, deleteChat, formatRelativeTime, type Chat } from '@/lib/api';
import { FeedbackModal, FeedbackButton } from '@/components/feedback/feedback-modal';

interface PendingChat {
  id: string;
  name: string;
  isLoading: boolean;
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedChatId?: string | null;
  onChatSelect?: (chatId: string) => void;
  onNewChat?: () => void;
  onLogoClick?: () => void;
  onChatDeleted?: () => void;
  isCreatingChat?: boolean;
  pendingChats?: PendingChat[]; // Chats currently being generated
}

export function Sidebar({
  className,
  selectedChatId,
  onChatSelect,
  onNewChat,
  onLogoClick,
  onChatDeleted,
  isCreatingChat,
  pendingChats = [],
  ...props
}: SidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);

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

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent chat selection

    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return;
    }

    setDeletingChatId(chatId);
    try {
      await deleteChat(chatId);
      await fetchChats();
      onChatDeleted?.();
    } catch (error) {
      console.error("Failed to delete chat:", error);
    } finally {
      setDeletingChatId(null);
    }
  };

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

      {/* New Chat Button */}
      <div className="px-4 mb-2">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      <div className="space-y-4 py-4 flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight flex items-center gap-2 text-slate-800">
            Topic Trees
          </h2>
          <div className="space-y-1">
            {/* Show pending chats with optimistic names */}
            {pendingChats.map((pending) => (
              <Button
                key={pending.id}
                variant="ghost"
                className="w-full justify-start text-slate-500 font-normal italic h-auto py-2"
                disabled={pending.isLoading}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-sm truncate">{pending.name}</span>
                </div>
              </Button>
            ))}

            {loading ? (
              <p className="px-4 text-sm text-slate-400">Loading...</p>
            ) : chats.length === 0 && pendingChats.length === 0 ? (
              <p className="px-4 text-sm text-slate-400">No knowledge spaces yet</p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.chat_id}
                  className="relative group"
                  onMouseEnter={() => setHoveredChatId(chat.chat_id)}
                  onMouseLeave={() => setHoveredChatId(null)}
                >
                  <Button
                    variant={selectedChatId === chat.chat_id ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start font-normal h-auto py-2 text-left pr-10",
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

                  {/* Delete button - appears on hover */}
                  {hoveredChatId === chat.chat_id && (
                    <button
                      onClick={(e) => handleDeleteChat(chat.chat_id, e)}
                      disabled={deletingChatId === chat.chat_id}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
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

