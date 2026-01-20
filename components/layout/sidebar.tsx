"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TreviSpinner, TreviLogoStatic } from '@/components/ui/trevi-logo';
import { cn } from '@/lib/utils';
import { getChats, deleteChat, formatRelativeTime, getUserMetadata, type Chat } from '@/lib/api';
import { FeedbackModal, FeedbackButton } from '@/components/feedback/feedback-modal';
import GradientText from '@/components/ui/gradient-text';

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
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    chatId: string;
    chatName: string;
    status: 'confirm' | 'deleting' | 'success';
  } | null>(null);

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

    // Find the chat name for the confirmation modal
    const chat = chats.find(c => c.chat_id === chatId);
    const chatName = chat?.chat_name || 'this chat';

    // Show confirmation modal instead of browser confirm
    setDeleteConfirmation({ isOpen: true, chatId, chatName, status: 'confirm' });
  };

  // Actually perform the deletion after confirmation
  const confirmDeleteChat = async () => {
    if (!deleteConfirmation) return;

    const { chatId, chatName } = deleteConfirmation;
    // Show deleting state
    setDeleteConfirmation({ isOpen: true, chatId, chatName, status: 'deleting' });

    try {
      await deleteChat(chatId);
      // Refresh chats after deletion
      const response = await getChats();
      setChats(response.chats);

      // Show success state
      setDeleteConfirmation({ isOpen: true, chatId, chatName, status: 'success' });

      // Auto-close after showing success
      setTimeout(() => {
        setDeleteConfirmation(null);
        onChatDeleted?.();
      }, 1500);
    } catch (error) {
      console.error("Failed to delete chat:", error);
      setDeleteConfirmation(null);
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
          "bg-slate-50/95 backdrop-blur-sm h-screen flex flex-col border-r border-slate-200",
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
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 md:hidden z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo - clickable to go home */}
        <div
          className="px-6 py-6 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => { onLogoClick?.(); onMobileClose?.(); }}
        >
          <TreviLogoStatic size={32} />
          <span className="text-xl font-bold tracking-tight text-slate-900">trevi</span>
        </div>

        <div className="px-6 mb-4">
          <p className="text-sm text-slate-500 mb-4">
            explore your <GradientText colors={["#023fe7ff", "#2563eb", "#3b82f6", "#2563eb", "#023fe7ff"]} animationSpeed={4} className="text-sm font-semibold">curiosity.</GradientText>
          </p>
        </div>

        {/* New Chat Button */}
        <div className="px-4 mb-2">
          <Button
            onClick={handleNewChatMobile}
            className="w-full justify-start gap-2 bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Plus className="w-4 h-4" />
            New Topic
          </Button>
        </div>

        <div className="space-y-4 py-4 flex-1 overflow-y-auto">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight flex items-center gap-2 text-slate-800">
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
                    className="w-full justify-between font-normal h-auto py-2.5 px-3 text-left bg-slate-50 border border-slate-200 hover:bg-slate-100"
                    disabled={pending.isLoading}
                  >
                    <span className="text-sm text-slate-600 truncate">
                      {pending.name || 'Creating Topic Tree...'}
                    </span>
                    <TreviSpinner size={16} className="text-slate-400 flex-shrink-0" />
                  </Button>
                </div>
              ))}

              {loading ? (
                <p className="px-4 text-sm text-slate-400">Loading...</p>
              ) : chats.length === 0 && pendingChats.length === 0 ? (
                <p className="px-4 text-sm text-slate-400">No Topic Trees yet</p>
              ) : (
                [...chats].reverse().map((chat) => (
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
                      onClick={() => handleChatSelectMobile(chat.chat_id)}
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

        <div className="px-4 py-2 sm:py-4">
          <FeedbackButton onClick={() => setIsFeedbackOpen(true)} />
        </div>

        {/* Feedback Modal */}
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation?.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteConfirmation.status === 'success' ? (
              // Success state
              <div className="flex flex-col items-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Chat deleted</h3>
                <p className="text-sm text-slate-500 mt-1">Successfully deleted</p>
              </div>
            ) : deleteConfirmation.status === 'deleting' ? (
              // Deleting state
              <div className="flex flex-col items-center py-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Deleting...</h3>
                <p className="text-sm text-slate-500 mt-1">Please wait</p>
              </div>
            ) : (
              // Confirm state
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Delete chat?</h3>
                    <p className="text-sm text-slate-500">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-5">
                  This will permanently delete <span className="font-medium text-slate-900">"{deleteConfirmation.chatName}"</span> and all of its conversations.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmation(null)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteChat}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

