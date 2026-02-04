"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, GripVertical, BookDown, Loader2, Route, MessageSquare, BookOpen, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageBubble } from './message-bubble';
import { StatusLine } from '@/components/ui/status-line';
import { QuickFeedback } from '@/components/feedback/quick-feedback';
import { ShareLinkButton } from '@/components/ui/share-link-button';
import { cn } from '@/lib/utils';
import { GistCard } from '@/components/chat/gist-card';
import { GistNotch } from '@/components/chat/shared/gist-notch';
import { ChatTabs, type TabDefinition } from '@/components/chat/shared/chat-tabs';
import { BibliographyList } from '@/components/chat/shared/bibliography-list';
import { NodeLabelBadge } from '@/components/chat/shared/node-label-badge';
import { getBibliography, fetchTreviBrief, downloadBrief, downloadConversation, type MessagePayload, type Citation, type BibliographyResponse } from '@/lib/api';
import type { BriefState } from '@/components/graph/types';

interface ConversationNode {
    id: string;
    label: string;
    payload: MessagePayload[];
    citations?: Citation[];
}

interface GraphNode {
    id: string;
    label: string;
    isDirection?: boolean;
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
    briefCache?: Map<string, BriefState>;
    onBriefCacheUpdate?: (nodeId: string, data: BriefState) => void;
    graphNodes?: GraphNode[];
    onDirectionClick?: (nodeId: string) => void;
    loadingNodeIds?: Set<string> | string[] | null;
}

const tabs: TabDefinition[] = [
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
    graphNodes,
    onDirectionClick,
    loadingNodeIds,
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
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isDownloadingBrief, setIsDownloadingBrief] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Trevi Brief states - derived from cache
    const briefState = activeNodeId ? briefCache?.get(activeNodeId) : undefined;
    const briefData = briefState?.data || null;
    const isBriefLoading = briefState?.isLoading || false;
    const briefConnectionRef = useRef<AbortController | null>(null);

    // Reset showGist when switching nodes
    React.useEffect(() => {
        if (activeNodeId) {
            const isRoot = conversationNodes.length > 0 && conversationNodes[0].id === activeNodeId;
            if (isRoot) {
                setShowGist(false);
                return;
            }
            const nodeBriefState = briefCache?.get(activeNodeId);
            const hasGistData = nodeBriefState?.data != null;
            const isLoading = nodeBriefState?.isLoading || false;
            if (showGist && !hasGistData && !isLoading) {
                setShowGist(false);
            }
        }
    }, [activeNodeId, conversationNodes, briefCache, showGist]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Detect mobile
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setActiveTab('full');
            } else {
                setActiveTab('thread');
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    const currentNodes = useMemo(() => {
        return activeTab === 'thread' ? threadNodes : conversationNodes;
    }, [activeTab, threadNodes, conversationNodes]);

    const directionNodes = useMemo(() => {
        return graphNodes?.filter(n => n.isDirection).map(n => ({ id: n.id, label: n.label })) || [];
    }, [graphNodes]);

    const currentTitle = activeTab === 'thread' && activeLabel ? activeLabel : rootLabel;

    // Check if active node is root - hide gist button for root
    const isRootNode = useMemo(() => {
        if (!activeNodeId) return true;
        return conversationNodes.length > 0 && conversationNodes[0].id === activeNodeId;
    }, [activeNodeId, conversationNodes]);

    // Show gist notch only on Thread tab (not Full or Bibliography) and not for root node
    const showGistNotch = activeTab === 'thread' && !isRootNode;

    const allCitations = useMemo(() => {
        return [...conversationNodes, ...threadNodes].flatMap(node => node.citations || []);
    }, [conversationNodes, threadNodes]);

    // Auto-scroll
    useEffect(() => {
        if (isStreaming) return;
        const timeoutId = setTimeout(() => {
            if (activeNodeId && nodeRefs.current.has(activeNodeId)) {
                nodeRefs.current.get(activeNodeId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (activeNodeId) {
                messagesContainerRef.current?.scrollTo({
                    top: messagesContainerRef.current?.scrollHeight || 0,
                    behavior: 'smooth'
                });
            } else {
                messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 150);
        return () => clearTimeout(timeoutId);
    }, [activeNodeId, activeTab, isStreaming]);

    useEffect(() => {
        if (isStreaming && isOpen) {
            const timeoutId = setTimeout(() => {
                messagesContainerRef.current?.scrollTo({
                    top: messagesContainerRef.current?.scrollHeight || 0,
                    behavior: 'smooth'
                });
            }, 350);
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

    useEffect(() => {
        if (activeTab === 'bibliography' && isOpen && chatId) {
            fetchBibliography();
        }
    }, [activeTab, isOpen, chatId, fetchBibliography]);

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

    // Handle gist toggle with fetch and width adjustment
    const handleGistToggle = () => {
        const newState = !showGist;

        if (newState && !briefData && !isBriefLoading && chatId && activeNodeId) {
            onBriefCacheUpdate?.(activeNodeId, { data: null, isLoading: true });

            const controller = new AbortController();
            briefConnectionRef.current = controller;

            fetchTreviBrief(
                chatId,
                activeNodeId,
                undefined,
                (response) => {
                    onBriefCacheUpdate?.(activeNodeId, { data: response.trevi_brief, isLoading: false });
                },
                (error) => {
                    console.error('Trevi Brief error:', error);
                    onBriefCacheUpdate?.(activeNodeId, { data: null, isLoading: false, error: error.error });
                },
                { signal: controller.signal }
            ).catch((err) => {
                if (err.name !== 'AbortError') {
                    console.error('Trevi Brief fetch failed:', err);
                    onBriefCacheUpdate?.(activeNodeId, { data: null, isLoading: false, error: err instanceof Error ? err.message : 'Unknown error' });
                }
            });
        }

        setShowGist(newState);
        if (newState) {
            const maxWidth = window.innerWidth * (MAX_WIDTH_VW / 100);
            setWidth(maxWidth);
        } else {
            setWidth(MIN_WIDTH);
        }
    };

    const handleGistDownload = async () => {
        if (chatId && activeNodeId && !isBriefLoading && !isDownloadingBrief) {
            setIsDownloadingBrief(true);
            try {
                await downloadBrief(chatId, activeNodeId);
            } catch (err) {
                console.error('Download failed:', err);
            } finally {
                setIsDownloadingBrief(false);
            }
        }
    };

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
                className={cn(
                    "fixed inset-0 z-50 h-[100dvh]",
                    "md:relative md:inset-auto md:z-auto md:h-auto",
                    "bg-white flex flex-col",
                    "w-full md:min-w-[400px] md:max-w-[50vw]",
                    "md:border-l md:border-slate-200",
                    "transition-transform duration-300 ease-out",
                    !isResizing && "md:transition-[transform,width]",
                    isVisible ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Resize Handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`
                        hidden md:flex absolute left-0 top-0 bottom-0 w-1 
                        cursor-col-resize group z-50 items-center justify-center
                        hover:bg-blue-500/10 ${isResizing ? 'bg-blue-500/20' : ''}
                    `}
                >
                    <div className={`
                        absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                        flex items-center justify-center w-4 h-8 rounded-full
                        bg-white border border-slate-200 shadow-sm
                        text-slate-400 group-hover:text-blue-500 group-hover:border-blue-300
                        transition-colors ${isResizing ? 'text-blue-500 border-blue-300' : ''}
                    `}>
                        <GripVertical className="w-3 h-3" />
                    </div>
                </div>

                {/* Header */}
                <header className="flex-shrink-0 bg-white border-b border-slate-200">
                    {/* Tab Bar */}
                    <div className="flex items-center h-12 sm:h-14 px-1">
                        <div className="flex-1 flex min-w-0 overflow-hidden">
                            <ChatTabs
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={(id) => setActiveTab(id as TabType)}
                                onRefetch={(id) => {
                                    if (id === 'bibliography') fetchBibliography();
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
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

                    {/* Context Title with Share/Download Buttons - visible on Thread and Full tabs */}
                    {activeTab !== 'bibliography' && (
                        <div className="flex items-center justify-between px-4 py-2.5 min-h-[56px] bg-slate-50 border-t border-slate-100">
                            <p className="text-sm font-semibold text-slate-700 truncate flex-1 min-w-0">{currentTitle}</p>
                            {/* Only show buttons on Thread tab */}
                            {activeTab === 'thread' && (
                                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                                    <button
                                        onClick={async () => {
                                            if (chatId && activeNodeId && !isDownloadingPdf) {
                                                setIsDownloadingPdf(true);
                                                try {
                                                    await downloadConversation(chatId, activeNodeId);
                                                } catch (err) {
                                                    console.error('Download failed:', err);
                                                } finally {
                                                    setIsDownloadingPdf(false);
                                                }
                                            }
                                        }}
                                        disabled={!chatId || !activeNodeId || isDownloadingPdf}
                                        className="p-1.5 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Download conversation as PDF"
                                    >
                                        {isDownloadingPdf ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <BookDown className="w-5 h-5" />
                                        )}
                                    </button>
                                    <ShareLinkButton chatId={chatId} nodeId={activeNodeId} />
                                </div>
                            )}
                        </div>
                    )}
                </header>

                {/* Notch + Gist Content Container - positioned to float below header */}
                {showGistNotch && (
                    <div className="flex-shrink-0 relative">
                        {/* Gist Content Expands HERE - before the notch in DOM */}
                        <AnimatePresence>
                            {showGist && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-white border-b border-slate-200 shadow-sm overflow-hidden">
                                        <GistCard
                                            nodeLabel={currentTitle || "Thread Summary"}
                                            onClose={() => {
                                                setShowGist(false);
                                                setWidth(MIN_WIDTH);
                                            }}
                                            className="border-none"
                                            isLoading={isBriefLoading}
                                            briefData={briefData}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* GistNotch Component - floats over content below */}
                        <GistNotch
                            isOpen={showGist}
                            isLoading={isBriefLoading}
                            isDownloading={isDownloadingBrief}
                            hasData={!!briefData}
                            onToggle={handleGistToggle}
                            onDownload={handleGistDownload}
                        />
                    </div>
                )}

                {/* Content Area */}
                <main className="flex-1 overflow-hidden flex flex-col relative bg-white">
                    <div className="flex-1 min-h-0 relative">
                        <div
                            ref={messagesContainerRef}
                            className="absolute inset-0 overflow-y-auto overscroll-contain"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="px-4 py-4 space-y-4">
                                {activeTab === 'bibliography' ? (
                                    <BibliographyList
                                        bibliography={bibliography}
                                        citations={allCitations}
                                        isLoading={isLoadingBibliography}
                                    />
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
                                                {currentNodes.length > 1 && (
                                                    <NodeLabelBadge label={node.label} isActive={node.id === activeNodeId} />
                                                )}
                                                <div className="space-y-4">
                                                    {(node.payload || []).map((msg, msgIdx) => (
                                                        <MessageBubble
                                                            key={`${node.id}-${msgIdx}`}
                                                            role={msg.role}
                                                            content={msg.content}
                                                            citations={node.citations}
                                                            onEdit={msg.role === 'user' && !isStreaming ? (text) => onEditMessage?.(node.id, text) : undefined}
                                                            directionNodes={msg.role === 'assistant' ? directionNodes : undefined}
                                                            onDirectionClick={msg.role === 'assistant' ? onDirectionClick : undefined}
                                                            loadingNodeIds={msg.role === 'assistant' ? loadingNodeIds : undefined}
                                                        />
                                                    ))}
                                                </div>
                                            </section>
                                        ))}

                                        {isStreaming && (
                                            <>
                                                <div className="pt-4 border-t border-slate-100 animate-fade-in">
                                                    <MessageBubble role="user" content={streamUserMessage || statusMessage || ""} />
                                                </div>
                                                <div className="py-2 animate-fade-in">
                                                    <StatusLine status="exploring" title="Exploring" subtitle={statusMessage || "Processing..."} />
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
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isStreaming}
                                className="p-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                            >
                                {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </form>
                </footer>
            </div>
        </>
    );
}
