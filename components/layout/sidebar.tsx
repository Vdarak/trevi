"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TreviSpinner, TreviLogoStatic } from '@/components/ui/trevi-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { getChats, deleteChat, formatRelativeTime, getUserMetadata, type Chat } from '@/lib/api';
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
  isMobileOpen?: boolean; // Mobile menu open state
  onMobileClose?: () => void; // Close mobile menu
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
  isMobileOpen = false,
  onMobileClose,
  ...props
}: SidebarProps) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);

  const fetchChatsAndCheckUser = async () => {
    try {
      // Fetch chats and user metadata simultaneously
      const [chatsResponse, userMetadata] = await Promise.all([
        getChats(),
        getUserMetadata(),
      ]);

      // Check if user needs onboarding
      if (!userMetadata.has_user_info) {
        router.push('/welcome');
        return;
      }

      setChats(chatsResponse.chats);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatsAndCheckUser();
  }, []);

  // Refresh chats when a new chat might have been created
  useEffect(() => {
    if (selectedChatId) {
      // Only fetch chats, user is already verified
      getChats().then(response => setChats(response.chats)).catch(console.error);
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
      // Refresh chats after deletion
      const response = await getChats();
      setChats(response.chats);
      onChatDeleted?.();
    } catch (error) {
      console.error("Failed to delete chat:", error);
    } finally {
      setDeletingChatId(null);
    }
  };

  // Handle chat select on mobile - close sidebar after selection
  const handleChatSelectMobile = (chatId: string) => {
    onChatSelect?.(chatId);
    onMobileClose?.();
  };

  // Handle new chat on mobile - close sidebar
  const handleNewChatMobile = () => {
    onNewChat?.();
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          // Base styles
          "bg-card/95 backdrop-blur-sm h-screen flex flex-col border-r border-border",
          // Desktop: always visible, fixed width
          "hidden md:flex md:w-64 md:relative md:flex-shrink-0",
          // Mobile: slide-in drawer
          isMobileOpen && "fixed inset-y-0 left-0 w-72 z-50 flex md:hidden shadow-xl animate-slide-in-left",
          className
        )}
        {...props}
      >
        {/* Mobile close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMobileClose?.();
          }}
          className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted md:hidden z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo - clickable to go home */}
        <div
          className="px-6 py-6 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => { onLogoClick?.(); onMobileClose?.(); }}
        >
          <TreviLogoStatic size={32} />
          <span className="text-xl font-bold tracking-tight text-foreground">trevi</span>
        </div>

        <div className="px-6 mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            explore your <span className="text-primary font-semibold">curiosity.</span>
          </p>
          <ThemeToggle />
        </div>

        {/* New Chat Button */}
        <div className="px-4 mb-2">
          <Button
            onClick={handleNewChatMobile}
            className="w-full justify-start gap-2"
          >
            <Plus className="w-4 h-4" />
            New Topic
          </Button>
        </div>

        <div className="space-y-4 py-4 flex-1 overflow-y-auto">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight flex items-center gap-2 text-foreground">
              Topic Trees
            </h2>
            <div className="space-y-1">
              {/* Show pending chats with optimistic names - styled like regular chats */}
              {pendingChats.map((pending) => (
                <div
                  key={pending.id}
                  className="relative group"
                >
                  <Button
                    variant="ghost"
                    className="w-full justify-between font-normal h-auto py-2.5 px-3 text-left bg-muted border border-border hover:bg-muted/80"
                    disabled={pending.isLoading}
                  >
                    <span className="text-sm text-muted-foreground truncate">
                      {pending.name || 'Creating Topic Tree...'}
                    </span>
                    <TreviSpinner size={16} className="text-muted-foreground flex-shrink-0" />
                  </Button>
                </div>
              ))}

              {loading ? (
                <p className="px-4 text-sm text-muted-foreground">Loading...</p>
              ) : chats.length === 0 && pendingChats.length === 0 ? (
                <p className="px-4 text-sm text-muted-foreground">No Topic Trees yet</p>
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
                        selectedChatId === chat.chat_id && "bg-secondary"
                      )}
                      onClick={() => handleChatSelectMobile(chat.chat_id)}
                    >
                      <div className="flex flex-col items-start w-full">
                        <span className="text-sm text-foreground truncate w-full">
                          {chat.chat_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(chat.created_at)}
                        </span>
                      </div>
                    </Button>

                    {/* Delete button - appears on hover */}
                    {hoveredChatId === chat.chat_id && (
                      <button
                        onClick={(e) => handleDeleteChat(chat.chat_id, e)}
                        disabled={deletingChatId === chat.chat_id}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
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

        <div className="px-4 py-2 sm:py-4">
          <FeedbackButton onClick={() => setIsFeedbackOpen(true)} />
        </div>

        {/* Feedback Modal */}
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      </div>
    </>
  );
}

