"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Send, Loader2, MessageSquare, Route, BookOpen, GripVertical } from 'lucide-react';
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
    conversationNodes: ConversationNode[];
    threadNodes?: ConversationNode[];
    rootLabel?: string;
    activeLabel?: string;
    activeNodeId?: string;
    isStreaming: boolean;
    statusMessage: string;
    onSendMessage: (message: string) => void;
    onClose: () => void;
}

const tabs = [
    { id: 'thread' as TabType, label: 'Thread', icon: Route },
    { id: 'full' as TabType, label: 'Full', icon: MessageSquare },
    { id: 'bibliography' as TabType, label: 'Sources', icon: BookOpen },
];

const MIN_WIDTH = 400;
const MAX_WIDTH_VW = 50;

export function ChatSidebar({
    isOpen,
    conversationNodes,
    threadNodes = [],
    rootLabel = 'Conversation',
    activeLabel,
    activeNodeId,
    isStreaming,
    statusMessage,
    onSendMessage,
    onClose,
}: ChatSidebarProps) {
    const [inputValue, setInputValue] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('thread');
    const [width, setWidth] = useState(MIN_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Handle entrance/exit animation
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setIsVisible(true));
            });
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Resize handling
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const maxWidth = window.innerWidth * (MAX_WIDTH_VW / 100);
            const newWidth = window.innerWidth - e.clientX;
            setWidth(Math.min(Math.max(newWidth, MIN_WIDTH), maxWidth));
        };

        const handleMouseUp = () => setIsResizing(false);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    // Get current nodes based on active tab
    const currentNodes = useMemo(() => {
        return activeTab === 'thread' ? threadNodes : conversationNodes;
    }, [activeTab, threadNodes, conversationNodes]);

    // Title based on active tab
    const currentTitle = activeTab === 'thread' && activeLabel ? activeLabel : rootLabel;

    // Auto-scroll to active node or top
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (activeNodeId && nodeRefs.current.has(activeNodeId)) {
                nodeRefs.current.get(activeNodeId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 150);
        return () => clearTimeout(timeoutId);
    }, [activeNodeId, activeTab]);

    // Focus input when sidebar opens
    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isStreaming) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    // Don't render on desktop if not open
    if (!shouldRender) return null;

    return (
        <>
            {/* Mobile backdrop */}
            <div 
                className={`
                    fixed inset-0 bg-black/20 z-40 md:hidden
                    transition-opacity duration-300
                    ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div
                ref={sidebarRef}
                style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? width : undefined }}
                className={`
                    fixed inset-0 z-50 
                    md:relative md:inset-auto md:z-auto
                    bg-white flex flex-col 
                    w-full md:min-w-[400px] md:max-w-[50vw]
                    md:border-l md:border-slate-200
                    transition-transform duration-300 ease-out
                    ${isVisible ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                {/* Resize Handle - Desktop only */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`
                        hidden md:flex
                        absolute left-0 top-0 bottom-0 w-1 
                        cursor-col-resize group z-10
                        items-center justify-center
                        hover:bg-blue-500/10
                        ${isResizing ? 'bg-blue-500/20' : ''}
                    `}
                >
                    {/* Resize indicator */}
                    <div className={`
                        absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                        flex items-center justify-center
                        w-5 h-10 rounded-full
                        bg-white border border-slate-200 shadow-sm
                        text-slate-400 group-hover:text-blue-500 group-hover:border-blue-300
                        transition-colors
                        ${isResizing ? 'text-blue-500 border-blue-300' : ''}
                    `}>
                        <GripVertical className="w-3 h-3" />
                    </div>
                </div>

                {/* Header */}
                <header className="flex-shrink-0 bg-white border-b border-slate-200 safe-area-top">
                    {/* Tab Bar */}
                    <div className="flex items-center h-14 px-1">
                        <div className="flex-1 flex">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            relative flex items-center gap-1.5 px-4 py-3
                                            text-sm font-medium transition-colors
                                            ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}
                                        `}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{tab.label}</span>
                                        {isActive && (
                                            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 mr-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Context Title */}
                    {activeTab !== 'bibliography' && (
                        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                            <p className="text-sm font-semibold text-slate-700 truncate">{currentTitle}</p>
                        </div>
                    )}
                </header>

                {/* Content Area */}
                <main 
                    ref={messagesContainerRef} 
                    className="flex-1 overflow-y-auto overscroll-contain bg-white"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    <div className="px-4 py-4 space-y-4">
                        {activeTab === 'bibliography' ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <BookOpen className="w-10 h-10 mb-3 opacity-40" />
                                <p className="text-sm font-medium">Sources coming soon</p>
                                <p className="text-xs mt-1 opacity-70">Bibliography will appear here</p>
                            </div>
                        ) : currentNodes.length === 0 && !isStreaming ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                                <p className="text-sm font-medium">
                                    {activeTab === 'thread' ? 'No thread selected' : 'No messages yet'}
                                </p>
                                <p className="text-xs mt-1 opacity-70">
                                    {activeTab === 'thread' ? 'Click a node to see its path' : 'Start exploring to see messages'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {currentNodes.map((node, idx) => (
                                    <section
                                        key={node.id}
                                        ref={(el: HTMLDivElement | null) => { if (el) nodeRefs.current.set(node.id, el); }}
                                        data-node-id={node.id}
                                        className={idx > 0 ? 'pt-4 border-t border-slate-100' : ''}
                                    >
                                        {/* Node Label Badge */}
                                        {currentNodes.length > 1 && (
                                            <div className={`
                                                inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 
                                                rounded-full text-xs font-medium
                                                ${node.id === activeNodeId 
                                                    ? 'bg-blue-100 text-blue-700' 
                                                    : 'bg-slate-100 text-slate-500'}
                                            `}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${node.id === activeNodeId ? 'bg-blue-500' : 'bg-slate-400'}`} />
                                                {node.label}
                                            </div>
                                        )}
                                        
                                        {/* Messages */}
                                        <div className="space-y-4">
                                            {(node.payload || []).map((msg, msgIdx) => (
                                                <MessageBubble
                                                    key={`${node.id}-${msgIdx}`}
                                                    role={msg.role}
                                                    content={msg.content}
                                                    citations={node.citations}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                ))}

                                {/* Streaming Indicator */}
                                {isStreaming && (
                                    <div className="flex items-center gap-2 py-3 text-slate-500">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">{statusMessage || 'Thinking...'}</span>
                                    </div>
                                )}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </main>

                {/* Input Footer */}
                <footer className="flex-shrink-0 bg-white border-t border-slate-200 safe-area-bottom">
                    <form onSubmit={handleSubmit} className="p-3">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Ask a follow-up..."
                                disabled={isStreaming}
                                className="
                                    flex-1 px-4 py-3 
                                    rounded-xl border border-slate-200 
                                    bg-slate-50 text-sm text-slate-800 
                                    placeholder:text-slate-400 
                                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 
                                    disabled:opacity-50 disabled:cursor-not-allowed 
                                    transition-all
                                "
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isStreaming}
                                className="
                                    p-3 rounded-xl 
                                    bg-blue-600 text-white 
                                    hover:bg-blue-700 active:scale-95 
                                    disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 
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
                </footer>
            </div>
        </>
    );
}
