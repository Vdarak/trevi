"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Send, Loader2, MessageSquare, Route, BookOpen, GripVertical, Sparkle, Check, Download } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageBubble } from './message-bubble';
import { TreviLogoAnimation } from '@/components/ui/trevi-logo';
import { StatusLine } from '@/components/ui/status-line';
import { QuickFeedback } from '@/components/feedback/quick-feedback';
import { ShareLinkButton } from '@/components/ui/share-link-button';
import { cn } from '@/lib/utils';
import { GistCard } from '@/components/chat/gist-card';
import { getBibliography, fetchTreviBrief, downloadBrief, type MessagePayload, type Citation, type BibliographyResponse, type TreviBriefResponse } from '@/lib/api';
import type { BriefState } from '@/components/graph/types';

interface ConversationNode {
    id: string;
    label: string;
    payload: MessagePayload[];
    citations?: Citation[];
}

type TabType = 'full' | 'thread' | 'bibliography';

interface ChatSidebarProps {
    isOpen: boolean;
    chatId?: string;
    conversationNodes: ConversationNode[];
    threadNodes?: ConversationNode[];
    rootLabel?: string;
    activeLabel?: string;
    activeNodeId?: string;
    isStreaming: boolean;
    statusMessage: string;
    streamUserMessage?: string;
    onSendMessage: (message: string) => void;
    onEditMessage?: (nodeId: string, newMessage: string) => void;
    onClose: () => void;
    // Brief cache for sharing data between sidebar and modal
    briefCache?: Map<string, BriefState>;
    onBriefCacheUpdate?: (nodeId: string, data: BriefState) => void;
}

const tabs = [
    { id: 'thread' as TabType, label: 'Thread', icon: Route },
    { id: 'full' as TabType, label: 'Full', icon: MessageSquare },
    { id: 'bibliography' as TabType, label: 'Bibliography', icon: BookOpen },
];

const MIN_WIDTH = 440;
const MAX_WIDTH_VW = 50;

export function ChatSidebar({
    isOpen,
    chatId,
    conversationNodes,
    threadNodes = [],
    rootLabel = 'Conversation',
    activeLabel,
    activeNodeId,
    isStreaming,
    statusMessage,
    streamUserMessage,
    onSendMessage,
    onEditMessage,
    onClose,
    briefCache,
    onBriefCacheUpdate,
}: ChatSidebarProps) {
    const [inputValue, setInputValue] = useState('');
    const [showGist, setShowGist] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('thread');
    const [width, setWidth] = useState(MIN_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [bibliography, setBibliography] = useState<BibliographyResponse | null>(null);
    const [isLoadingBibliography, setIsLoadingBibliography] = useState(false);

    // Trevi Brief states - derived from cache
    const briefState = activeNodeId ? briefCache?.get(activeNodeId) : undefined;
    const briefData = briefState?.data || null;
    const isBriefLoading = briefState?.isLoading || false;
    const briefConnectionRef = useRef<AbortController | null>(null);

    // Reset showBrief when switching nodes (optional, but good UX)
    React.useEffect(() => {
        if (activeNodeId) {
            // If we want to keep brief open if it exists, remove this.
            // But usually switching nodes should probably close the brief unless purely syncing.
            // For now, let's NOT auto-close it if data exists, but user asked for sync.
            // Actually, if I switch nodes, I probably want to see the brief if I had it open...
            // BUT, if I switch to a new node that doesn't have a brief, showing an empty brief might be annoying?
            // The prompt says "When clicked on brief in sidebar it should automatically update on the modal".
            // It doesn't strictly say "openness" is synced, but "update".
            // Let's keep `showGist` local for now, but ensure data syncs.
            // Correction: The prompt says "black ones... should not be visible or open".
            // So for root nodes, force close.
            const isRoot = conversationNodes.length > 0 && conversationNodes[0].id === activeNodeId;
            if (isRoot) setShowGist(false);
        }
    }, [activeNodeId, conversationNodes]);

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

    // Check if active node is a root node (first node = root, no brief history)
    const isRootNode = useMemo(() => {
        if (!activeNodeId) return true;
        // Root is the first node in the conversation
        return conversationNodes.length > 0 && conversationNodes[0].id === activeNodeId;
    }, [activeNodeId, conversationNodes]);

    // Auto-scroll to active node or top/bottom
    useEffect(() => {
        if (isStreaming) return; // Don't interfere with streaming scroll
        const timeoutId = setTimeout(() => {
            if (activeNodeId && nodeRefs.current.has(activeNodeId)) {
                // Scenario A: Node exists in list - Scroll to it
                nodeRefs.current.get(activeNodeId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (activeNodeId) {
                // Scenario B: Node is active (e.g. Exploring/Follow-up) but not in list (e.g. empty payload)
                // Scroll to BOTTOM to show the parent context (last rendered node) + any loading indicators
                messagesContainerRef.current?.scrollTo({
                    top: messagesContainerRef.current?.scrollHeight || 0,
                    behavior: 'smooth'
                });
            } else {
                // Scenario C: No active node - Scroll to top
                messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 150);
        return () => clearTimeout(timeoutId);
    }, [activeNodeId, activeTab, isStreaming]);

    // Scroll to bottom when streaming/exploring starts (with longer delay for sidebar animation)
    useEffect(() => {
        if (isStreaming && isOpen) {
            const timeoutId = setTimeout(() => {
                messagesContainerRef.current?.scrollTo({
                    top: messagesContainerRef.current?.scrollHeight || 0,
                    behavior: 'smooth'
                });
            }, 350); // Longer delay to wait for sidebar animation
            return () => clearTimeout(timeoutId);
        }
    }, [isStreaming, isOpen]);

    const fetchBibliography = useCallback(() => {
        if (!chatId) return;
        setIsLoadingBibliography(true);
        getBibliography(chatId)
            .then((data: BibliographyResponse) => setBibliography(data))
            .catch((err: Error) => console.error("Failed to fetch bibliography:", err))
            .finally(() => setIsLoadingBibliography(false));
    }, [chatId]);

    // Fetch bibliography when tab becomes active
    useEffect(() => {
        if (activeTab === 'bibliography' && isOpen && chatId) {
            fetchBibliography();
        }
    }, [activeTab, isOpen, chatId, fetchBibliography]);

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
                id="chat-sidebar-container"
                ref={sidebarRef}
                style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? width : undefined }}
                className={`
                    fixed inset-0 z-50 h-[100dvh]
                    md:relative md:inset-auto md:z-auto md:h-auto
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
                        cursor-col-resize group z-50
                        items-center justify-center
                        hover:bg-blue-500/10
                        ${isResizing ? 'bg-blue-500/20' : ''}
                    `}
                >
                    {/* Resize indicator */}
                    <div className={`
                        absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                        flex items-center justify-center
                        w-4 h-8 rounded-full
                        bg-white border border-slate-200 shadow-sm
                        text-slate-400 group-hover:text-blue-500 group-hover:border-blue-300
                        transition-colors
                        ${isResizing ? 'text-blue-500 border-blue-300' : ''}
                    `}>
                        <GripVertical className="w-3 h-3" />
                    </div>
                </div>

                {/* Header */}
                <header className="flex-shrink-0 bg-white border-b border-slate-200 pt-[env(safe-area-inset-top)]">
                    {/* Tab Bar */}
                    <div className="flex items-center h-12 sm:h-14 px-1">
                        <div className="flex-1 flex min-w-0 overflow-hidden">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            if (tab.id === 'bibliography' && isActive) {
                                                fetchBibliography();
                                            }
                                            setActiveTab(tab.id);
                                        }}
                                        className={`
                                            relative flex items-center justify-center gap-1.5 px-3 py-3
                                            text-sm font-medium transition-colors whitespace-nowrap
                                            ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}
                                        `}
                                    >
                                        <Icon className="w-5 h-5" />
                                        {isActive && <span>{tab.label}</span>}
                                        {isActive && (
                                            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                            {activeTab === 'thread' && (
                                <>
                                    <ShareLinkButton
                                        chatId={chatId}
                                        nodeId={activeNodeId}
                                    />
                                </>
                            )}
                            <QuickFeedback
                                context="component"
                                componentName="chat_sidebar"
                                popoverPosition="bottom"
                                size="lg"
                            />
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Context Title */}
                    {activeTab !== 'bibliography' && (
                        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-700 truncate flex-1">{currentTitle}</p>

                            {/* Trevi Brief Toggle - hidden for root nodes */}
                            {!isRootNode && (
                                <div className="flex items-center">
                                    {/* Download Button - animated reveal when Gist is open */}
                                    <AnimatePresence>
                                        {showGist && (
                                            <motion.button
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                transition={{ duration: 0.15, ease: "easeOut" }}
                                                onClick={() => {
                                                    if (chatId && activeNodeId) {
                                                        downloadBrief(chatId, activeNodeId).catch((err) => {
                                                            console.error('Download failed:', err);
                                                        });
                                                    }
                                                }}
                                                className="flex items-center justify-center px-2.5 py-1.5 rounded-l-lg border border-r-0 text-xs font-semibold select-none bg-white text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-colors overflow-hidden"
                                                title="Download Brief as PDF"
                                            >
                                                <Download className="w-3.5 h-3.5 flex-shrink-0" />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                    <button
                                        onClick={() => {
                                            const newState = !showGist;

                                            // If opening brief for the first time and no data, fetch it
                                            if (newState && !briefData && !isBriefLoading && chatId && activeNodeId) {
                                                // Set loading state in cache immediately
                                                onBriefCacheUpdate?.(activeNodeId, { data: null, isLoading: true });

                                                // Create AbortController for cleanup
                                                const controller = new AbortController();
                                                briefConnectionRef.current = controller;

                                                fetchTreviBrief(
                                                    chatId,
                                                    activeNodeId,
                                                    undefined, // No progressive updates for now
                                                    (response) => {
                                                        // Update parent cache with data
                                                        onBriefCacheUpdate?.(activeNodeId, { data: response.trevi_brief, isLoading: false });
                                                    },
                                                    (error) => {
                                                        console.error('Trevi Brief error:', error);
                                                        // Update parent cache with error
                                                        onBriefCacheUpdate?.(activeNodeId, { data: null, isLoading: false, error: error.error });
                                                    },
                                                    { signal: controller.signal }
                                                ).catch((err) => {
                                                    // Handle abort or other errors
                                                    if (err.name !== 'AbortError') {
                                                        console.error('Trevi Brief fetch failed:', err);
                                                        onBriefCacheUpdate?.(activeNodeId, { data: null, isLoading: false, error: err instanceof Error ? err.message : 'Unknown error' });
                                                    }
                                                });
                                            }

                                            setShowGist(newState);
                                            if (newState) {
                                                // Auto-resize to MAXIMUM allowed width when opening brief
                                                const maxWidth = window.innerWidth * (MAX_WIDTH_VW / 100);
                                                setWidth(maxWidth);
                                            } else {
                                                // Optional: Shrink back? User requested: "when trevi brief is closed, automatically resize the chat side bar to minimum width"
                                                setWidth(MIN_WIDTH);
                                            }
                                        }}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 transition-all duration-200 border text-xs font-semibold select-none",
                                            showGist ? "rounded-r-lg" : "rounded-lg",
                                            isBriefLoading
                                                ? "bg-blue-100 text-blue-600 border-blue-200 shadow-inner"
                                                : briefData
                                                    ? "bg-green-100 text-green-600 border-green-200 shadow-inner"
                                                    : showGist
                                                        ? "bg-blue-100 text-blue-600 border-blue-200 shadow-inner"
                                                        : "bg-white text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50"
                                        )}
                                        title={isBriefLoading ? "Generating..." : briefData ? "Gist Generated" : showGist ? "Close Gist" : "View Gist"}
                                    >
                                        {isBriefLoading ? (
                                            <motion.span
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                className="flex items-center justify-center"
                                            >
                                                <Sparkle className="w-3.5 h-3.5 fill-blue-600" />
                                            </motion.span>
                                        ) : briefData ? (
                                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                        ) : (
                                            <motion.span
                                                animate={{ rotate: showGist ? 45 : 0 }}
                                                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                                                className="flex items-center justify-center font-bold"
                                            >
                                                <Sparkle
                                                    className={cn(
                                                        "w-3.5 h-3.5 transition-colors duration-200",
                                                        showGist ? "fill-blue-600" : "fill-blue-500"
                                                    )}
                                                />
                                            </motion.span>
                                        )}
                                        <span>Gist</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-hidden flex flex-col relative bg-white">

                    {/* Trevi Brief Section (Shifts content down) */}
                    <AnimatePresence>
                        {showGist && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="flex-shrink-0 w-full min-w-0 overflow-hidden z-10 bg-slate-50/50 shadow-sm relative border-b border-blue-100"
                            >
                                <GistCard
                                    nodeLabel={currentTitle || "Thread Summary"}
                                    onClose={() => {
                                        setShowGist(false);
                                        setWidth(MIN_WIDTH); // Auto-shrink on close
                                    }}
                                    className="border-none"
                                    isLoading={isBriefLoading}
                                    briefData={briefData}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Chat Layer */}
                    <div className="flex-1 min-h-0 relative">
                        <div
                            ref={messagesContainerRef}
                            className="absolute inset-0 overflow-y-auto overscroll-contain"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="px-4 py-4 space-y-4">
                                {activeTab === 'bibliography' ? (
                                    isLoadingBibliography ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                            <Loader2 className="w-8 h-8 mb-3 animate-spin text-blue-500" />
                                            <p className="text-sm font-medium">Loading bibliography...</p>
                                        </div>
                                    ) : bibliography && Object.keys(bibliography.reference_usage).length > 0 ? (
                                        <div className="space-y-6">
                                            {/* Helper to find citation details across all nodes */}
                                            {(() => {
                                                // Collect all unique citations keyed by URL
                                                const urlToCitation = new Map<string, Citation>();

                                                // Also map indices to URLs if needed, but primary key is URL from API
                                                [...conversationNodes, ...threadNodes].forEach(node => {
                                                    node.citations?.forEach(c => {
                                                        if (c.url) urlToCitation.set(c.url, c);
                                                    });
                                                });

                                                return Object.entries(bibliography.reference_usage).map(([url, labels], idx) => {
                                                    const citation = urlToCitation.get(url);

                                                    // The key is the URL itself
                                                    const displayUrl = url;

                                                    // Try to get a nice title, otherwise use the URL or domain
                                                    let displayTitle = citation?.title;
                                                    if (!displayTitle) {
                                                        try {
                                                            const urlObj = new URL(url);
                                                            displayTitle = urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
                                                        } catch (e) {
                                                            displayTitle = url;
                                                        }
                                                    }

                                                    // Filter out "No meaningful topic identified"
                                                    const validLabels = labels.filter(label =>
                                                        label !== "General"
                                                    );

                                                    // Use simple sequential numbering
                                                    const displayIndex = idx + 1;

                                                    return (
                                                        <div key={url} className="group relative pl-0 sm:pl-0">
                                                            <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100/60 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200">
                                                                {/* Index Badge */}
                                                                <div className="flex-shrink-0">
                                                                    <div className="
                                                                        flex items-center justify-center 
                                                                        w-6 h-6 rounded-md 
                                                                        bg-white border border-slate-200 
                                                                        text-xs font-mono font-medium text-slate-500
                                                                        group-hover:border-blue-200 group-hover:text-blue-600
                                                                        transition-colors
                                                                    ">
                                                                        {displayIndex}
                                                                    </div>
                                                                </div>

                                                                {/* Content */}
                                                                <div className="flex-1 min-w-0 space-y-2">
                                                                    {/* Title & Link */}
                                                                    <div>
                                                                        <a
                                                                            href={url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="group/link block"
                                                                        >
                                                                            <h4 className="text-sm font-semibold text-slate-800 leading-snug group-hover/link:text-blue-600 transition-colors line-clamp-2">
                                                                                {displayTitle}
                                                                            </h4>
                                                                            <div className="text-xs text-slate-400 font-mono mt-1 w-full truncate opacity-70 group-hover/link:opacity-100 transition-all">
                                                                                {displayUrl}
                                                                            </div>
                                                                        </a>
                                                                    </div>

                                                                    {/* Usage Labels */}
                                                                    {validLabels.length > 0 && (
                                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                                            {validLabels.map((label, labelIdx) => (
                                                                                <span
                                                                                    key={`${url}-${labelIdx}`}
                                                                                    className="
                                                                                        inline-flex items-center px-2 py-0.5 
                                                                                        rounded-md text-[10px] uppercase tracking-wider font-semibold 
                                                                                        bg-white border border-slate-200 text-slate-500
                                                                                    "
                                                                                >
                                                                                    {label}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                            <BookOpen className="w-10 h-10 mb-3 opacity-40" />
                                            <p className="text-sm font-medium">No sources found</p>
                                            <p className="text-xs mt-1 opacity-70">Bibliography is empty</p>
                                        </div>
                                    )
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
                                                            onEdit={msg.role === 'user' && !isStreaming ? (text) => onEditMessage?.(node.id, text) : undefined}
                                                        />
                                                    ))}
                                                </div>
                                            </section>
                                        ))}

                                        {/* Optimistic User Message & Streaming Indicator */}
                                        {isStreaming && (
                                            <>
                                                {/* Show user message immediately */}
                                                <div className="pt-4 border-t border-slate-100 animate-fade-in">
                                                    <MessageBubble
                                                        role="user"
                                                        content={streamUserMessage || statusMessage || ""}
                                                    />
                                                </div>

                                                {/* Status Line */}
                                                <div className="py-2 animate-fade-in">
                                                    <StatusLine
                                                        status="exploring"
                                                        title="Exploring"
                                                        subtitle={statusMessage || "Processing..."}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    </div>
                </main>

                {/* Input Footer */}
                <footer className="flex-shrink-0 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
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
                                    bg-slate-50 text-base text-slate-800 
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
                                    bg-slate-900 text-white 
                                    hover:bg-slate-800 active:scale-95 
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
            </div >
        </>
    );
}
