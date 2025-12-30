"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import type { MessagePayload } from '@/lib/api';

interface ConversationNode {
    id: string;
    label: string;
    payload: MessagePayload[];
}

interface ChatSidebarProps {
    isOpen: boolean;
    conversationNodes: ConversationNode[]; // All nodes with conversations in sequence
    isStreaming: boolean;
    statusMessage: string;
    onSendMessage: (message: string) => void;
    onClose: () => void;
}

/**
 * A push-style sidebar that shows the full conversation history.
 * Pushes the canvas content to make space - doesn't overlay.
 */
export function ChatSidebar({
    isOpen,
    conversationNodes,
    isStreaming,
    statusMessage,
    onSendMessage,
    onClose,
}: ChatSidebarProps) {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Flatten all messages from all nodes into a single conversation
    const allMessages = useMemo(() => {
        return conversationNodes.flatMap(node => node.payload || []);
    }, [conversationNodes]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [allMessages]);

    // Focus input when sidebar opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isStreaming) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    return (
        <div
            className={`
        h-full bg-slate-50 border-l border-slate-200
        flex flex-col
        transition-all duration-300 ease-out
        ${isOpen ? 'w-[400px]' : 'w-0 overflow-hidden'}
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-slate-600" />
                    <h2 className="font-semibold text-slate-800">Full Conversation</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {allMessages.length === 0 && !isStreaming ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        No conversation yet. Start exploring!
                    </div>
                ) : (
                    <>
                        {allMessages.map((msg, index) => (
                            <MessageBubble
                                key={index}
                                role={msg.role}
                                content={msg.content}
                            />
                        ))}

                        {/* Streaming/thinking state */}
                        {isStreaming && (
                            <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{statusMessage || 'Thinking...'}</span>
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        disabled={isStreaming}
                        className="
              flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50
              text-sm text-slate-800 placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
            "
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isStreaming}
                        className="
              p-2.5 rounded-xl bg-slate-800 text-white
              hover:bg-slate-700 active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
              transition-all
            "
                    >
                        {isStreaming ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
