"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Send, Loader2, MessageSquare, Route, BookOpen } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import type { MessagePayload, Citation } from '@/lib/api';

interface ConversationNode {
    id: string;
    label: string;
    payload: MessagePayload[];
    citations?: Citation[];
}

type TabType = 'full' | 'thread' | 'bibliography';

interface ChatSidebarProps {
    isOpen: boolean;
    conversationNodes: ConversationNode[]; // All nodes with conversations in sequence
    threadNodes?: ConversationNode[]; // Nodes from root to active (current thread)
    rootLabel?: string; // Label of root node (full conversation title)
    activeLabel?: string; // Label of active/clicked node (thread title)
    isStreaming: boolean;
    statusMessage: string;
    onSendMessage: (message: string) => void;
    onClose: () => void;
}

interface MessageWithCitations {
    message: MessagePayload;
    citations?: Citation[];
}

/**
 * A push-style sidebar that shows the full conversation history.
 * Pushes the canvas content to make space - doesn't overlay.
 */
export function ChatSidebar({
    isOpen,
    conversationNodes,
    threadNodes = [],
    rootLabel = 'Conversation',
    activeLabel,
    isStreaming,
    statusMessage,
    onSendMessage,
    onClose,
}: ChatSidebarProps) {
    const [inputValue, setInputValue] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('full');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Flatten all messages from all nodes into a single conversation with citations
    const allMessagesWithCitations = useMemo(() => {
        return conversationNodes.flatMap(node =>
            (node.payload || []).map(msg => ({
                message: msg,
                citations: node.citations
            }))
        );
    }, [conversationNodes]);

    // Flatten thread messages (root to active) with citations
    const threadMessagesWithCitations = useMemo(() => {
        return threadNodes.flatMap(node =>
            (node.payload || []).map(msg => ({
                message: msg,
                citations: node.citations
            }))
        );
    }, [threadNodes]);

    // Get current messages based on active tab
    const currentMessagesWithCitations = useMemo(() => {
        return activeTab === 'thread' ? threadMessagesWithCitations : allMessagesWithCitations;
    }, [activeTab, allMessagesWithCitations, threadMessagesWithCitations]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentMessagesWithCitations]);

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

    const tabs = [
        { id: 'full' as TabType, label: 'Full', icon: MessageSquare },
        { id: 'thread' as TabType, label: 'Thread', icon: Route },
        { id: 'bibliography' as TabType, label: 'Sources', icon: BookOpen },
    ];

    // Scroll behavior: Both start from top
    const messagesTopRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Both tabs start from top
        messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeTab, currentMessagesWithCitations]);

    // Determine title based on active tab
    const currentTitle = activeTab === 'thread' && activeLabel ? activeLabel : rootLabel;

    return (
        <div
            className={`h-full bg-slate-50 border-l border-slate-200 flex flex-col transition-all duration-300 ease-out ${isOpen ? 'w-[400px]' : 'w-0 overflow-hidden'}`}
        >
            {/* Header with tabs and title */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200">
                {/* Tabs row */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {/* Title row - sticky context */}
                {activeTab !== 'bibliography' && (
                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-700 text-sm truncate">
                            {currentTitle}
                        </h3>
                        {activeTab === 'thread' && activeLabel && (
                            <p className="text-xs text-slate-400 mt-0.5">Path from root → current node</p>
                        )}
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
                <div ref={messagesTopRef} />
                {activeTab === 'bibliography' ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                        <BookOpen className="w-8 h-8 mb-2 opacity-50" />
                        <p>Bibliography coming soon</p>
                        <p className="text-xs mt-1">Sources will appear here</p>
                    </div>
                ) : currentMessagesWithCitations.length === 0 && !isStreaming ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        {activeTab === 'thread' ? 'Select a node to see its thread' : 'No conversation yet. Start exploring!'}
                    </div>
                ) : (
                    <>
                        {currentMessagesWithCitations.map((item, index) => (
                            <MessageBubble
                                key={index}
                                role={item.message.role}
                                content={item.message.content}
                                citations={item.citations}
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
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isStreaming}
                        className="p-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
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

