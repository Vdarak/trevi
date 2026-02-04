"use client";

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MessagePayload, Citation } from '@/lib/api';
import { fetchTreviBrief, downloadBrief } from '@/lib/api';
import type { BriefState } from '@/components/graph/types';
import { QuickFeedback } from '@/components/feedback/quick-feedback';
import { ShareLinkButton } from '@/components/ui/share-link-button';
import { GistCard } from '@/components/chat/gist-card';
import { GistNotch } from '@/components/chat/shared/gist-notch';
import { MessageList, type ConversationNode } from '@/components/chat/shared/message-list';
import { ChatInput } from '@/components/chat/shared/chat-input';



interface GraphNode {
    id: string;
    label: string;
    isDirection?: boolean;
}

interface NodeConversationPanelProps {
    isOpen: boolean;
    messages: MessagePayload[];
    nodeLabel?: string;
    onClose: () => void;
    citations?: Citation[];
    onSendMessage?: (message: string) => void;
    isStreaming?: boolean;
    statusMessage?: string;
    streamUserMessage?: string;
    clickPosition?: { x: number; y: number };
    chatId?: string;
    nodeId?: string;
    isRootNode?: boolean; // Hide brief button for root nodes
    // Brief cache for sharing data between sidebar and modal
    briefCache?: Map<string, BriefState>;
    onBriefCacheUpdate?: (nodeId: string, data: BriefState) => void;
    // Direction nodes for clickable exploration
    graphNodes?: GraphNode[];
    onDirectionClick?: (nodeId: string) => void;
    loadingNodeIds?: Set<string> | string[] | null;
}

/**
 * Custom hook for Gist logic - shared between Panel and Modal
 */
function useGistLogic({
    nodeId,
    isRootNode,
    briefCache,
    chatId,
    onBriefCacheUpdate,
}: {
    nodeId?: string;
    isRootNode?: boolean;
    briefCache?: Map<string, BriefState>;
    chatId?: string;
    onBriefCacheUpdate?: (nodeId: string, data: BriefState) => void;
}) {
    const [showGist, setShowGist] = useState(false);
    const [isDownloadingBrief, setIsDownloadingBrief] = useState(false);
    const briefConnectionRef = useRef<AbortController | null>(null);

    // Trevi Brief states - derived from cache
    const briefState = nodeId ? briefCache?.get(nodeId) : undefined;
    const briefData = briefState?.data || null;
    const isBriefLoading = briefState?.isLoading || false;

    // Reset showGist when switching nodes - close if the new node doesn't have gist data
    React.useEffect(() => {
        if (nodeId) {
            // Close gist for root nodes
            if (isRootNode) {
                setShowGist(false);
                return;
            }
            // If gist is open but the new node has no cached data and is not loading, close it
            const nodeBriefState = briefCache?.get(nodeId);
            const hasGistData = nodeBriefState?.data != null;
            const isLoading = nodeBriefState?.isLoading || false;
            if (showGist && !hasGistData && !isLoading) {
                setShowGist(false);
            }
        }
    }, [nodeId, isRootNode, briefCache, showGist]);

    const handleToggleGist = () => {
        const newState = !showGist;

        // If opening brief for the first time and no data, fetch it
        if (newState && !briefData && !isBriefLoading && chatId && nodeId) {
            // Set loading in cache
            onBriefCacheUpdate?.(nodeId, { data: null, isLoading: true });

            const controller = new AbortController();
            briefConnectionRef.current = controller;

            fetchTreviBrief(
                chatId,
                nodeId,
                undefined,
                (response) => {
                    // Update cache with data
                    onBriefCacheUpdate?.(nodeId, { data: response.trevi_brief, isLoading: false });
                },
                (error) => {
                    console.error('Trevi Brief error:', error);
                    // Update cache with error
                    onBriefCacheUpdate?.(nodeId, { data: null, isLoading: false, error: error.error });
                },
                { signal: controller.signal }
            ).catch((err) => {
                if (err.name !== 'AbortError') {
                    console.error('Trevi Brief fetch failed:', err);
                    onBriefCacheUpdate?.(nodeId, { data: null, isLoading: false, error: err instanceof Error ? err.message : 'Unknown error' });
                }
            });
        }

        setShowGist(newState);
    };

    const handleDownloadBrief = async () => {
        if (chatId && nodeId && !isBriefLoading && !isDownloadingBrief) {
            setIsDownloadingBrief(true);
            try {
                await downloadBrief(chatId, nodeId);
            } catch (err) {
                console.error('Download failed:', err);
            } finally {
                setIsDownloadingBrief(false);
            }
        }
    };

    return {
        showGist,
        setShowGist,
        briefData,
        isBriefLoading,
        isDownloadingBrief,
        handleToggleGist,
        handleDownloadBrief,
    };
}

/**
 * Node conversation panel with title bar, content, and chat input.
 * Can be used as both a floating panel and a center modal.
 */
export function NodeConversationPanel({
    isOpen,
    messages,
    nodeLabel,
    onClose,
    citations,
    onSendMessage,
    isStreaming = false,
    statusMessage = '',
    streamUserMessage,
    chatId,
    nodeId,
    isRootNode = false,
    briefCache,
    onBriefCacheUpdate,
    graphNodes,
    onDirectionClick,
    loadingNodeIds,
}: NodeConversationPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter direction nodes for clickable bullets
    const directionNodes = useMemo(() => {
        return graphNodes?.filter(n => n.isDirection).map(n => ({ id: n.id, label: n.label })) || [];
    }, [graphNodes]);

    // Gist logic
    const {
        showGist,
        briefData,
        isBriefLoading,
        isDownloadingBrief,
        handleToggleGist,
        handleDownloadBrief,
    } = useGistLogic({ nodeId, isRootNode, briefCache, chatId, onBriefCacheUpdate });

    // Check if we have any messages
    const hasMessages = messages.length > 0;

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && !showGist && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, showGist]);

    if (!isOpen || !hasMessages) return null;

    // Convert messages to ConversationNode format for MessageList
    const conversationNodes: ConversationNode[] = [{
        id: nodeId || 'panel',
        label: nodeLabel || 'Conversation',
        payload: messages,
        citations,
    }];

    return (
        <div
            ref={panelRef}
            className="w-[400px] max-h-[60vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in flex flex-col relative"
        >
            {/* Header with title and close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0 z-10 relative">
                <h3 className="font-semibold text-slate-800 text-sm truncate pr-2 flex-1">
                    {nodeLabel || 'Conversation'}
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <ShareLinkButton
                        chatId={chatId}
                        nodeId={nodeId}
                        size="md"
                    />
                    <QuickFeedback
                        context="component"
                        componentName="node_panel"
                        popoverPosition="bottom"
                        size="md"
                    />
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

            </div>

            {/* Notch + Gist Content Container - matching ChatSidebar pattern */}
            {!isRootNode && (
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
                                        nodeLabel={nodeLabel || "Current Topic"}
                                        onClose={() => { }}
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
                        onToggle={handleToggleGist}
                        onDownload={handleDownloadBrief}
                    />
                </div>
            )}

            {/* Main Content Area (Stacking Context) */}
            <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">

                {/* Chat Layer (Takes remaining space) */}
                <div className="flex-1 min-h-0 flex flex-col bg-white relative">
                    {/* Scrollable content */}
                    <div
                        className="flex-1 overflow-y-auto overflow-x-hidden p-4 text-sm text-slate-700 leading-relaxed"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                    >
                        <MessageList
                            nodes={conversationNodes}
                            activeNodeId={nodeId}
                            showNodeLabels={false}
                            isStreaming={isStreaming}
                            streamUserMessage={streamUserMessage}
                            statusMessage={statusMessage}
                            directionNodes={directionNodes}
                            onDirectionClick={onDirectionClick}
                            loadingNodeIds={loadingNodeIds}
                        />
                    </div>

                    {/* Chat input */}
                    {onSendMessage && (
                        <ChatInput
                            onSendMessage={onSendMessage}
                            isStreaming={isStreaming}
                            statusMessage={statusMessage}
                            size="sm"
                            inputRef={inputRef}
                            className="border-t border-slate-100"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Center modal version of the conversation panel.
 * Opens in the center of the canvas with a backdrop.
 */
export function NodeConversationModal({
    isOpen,
    messages,
    nodeLabel,
    onClose,
    citations,
    onSendMessage,
    isStreaming = false,
    statusMessage = '',
    streamUserMessage,
    clickPosition,
    chatId,
    nodeId,
    isRootNode = false,
    briefCache,
    onBriefCacheUpdate,
    graphNodes,
    onDirectionClick,
    loadingNodeIds,
}: NodeConversationPanelProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter direction nodes for clickable bullets
    const directionNodes = useMemo(() => {
        return graphNodes?.filter(n => n.isDirection).map(n => ({ id: n.id, label: n.label })) || [];
    }, [graphNodes]);

    // Gist logic
    const {
        showGist,
        briefData,
        isBriefLoading,
        isDownloadingBrief,
        handleToggleGist,
        handleDownloadBrief,
    } = useGistLogic({ nodeId, isRootNode, briefCache, chatId, onBriefCacheUpdate });

    // Calculate transform origin based on click position
    const transformOrigin = useMemo(() => {
        if (!clickPosition) return 'center center';
        // Convert screen position to percentage relative to viewport
        const xPercent = (clickPosition.x / window.innerWidth) * 100;
        const yPercent = (clickPosition.y / window.innerHeight) * 100;
        return `${xPercent}% ${yPercent}%`;
    }, [clickPosition]);

    // Check if we have any messages
    const hasMessages = messages.length > 0;

    // Close on escape key or backdrop click
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && !showGist && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, showGist]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen || !hasMessages) return null;

    // Convert messages to ConversationNode format for MessageList
    const conversationNodes: ConversationNode[] = [{
        id: nodeId || 'modal',
        label: nodeLabel || 'Conversation',
        payload: messages,
        citations,
    }];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/20 backdrop-blur-sm animate-fade-in"
            onClick={handleBackdropClick}
            style={{ transformOrigin }}
        >
            <div
                ref={modalRef}
                // Updated max-width to 4xl for wider canvas feeling
                className="w-full h-full md:h-auto md:max-w-4xl md:max-h-[80vh] bg-white md:rounded-2xl shadow-2xl md:border border-slate-200 overflow-hidden flex flex-col relative"
                style={{
                    animation: 'modal-scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    transformOrigin
                }}
            >
                {/* Header with title and close button */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0 z-10 relative">
                    <h3 className="font-semibold text-slate-800 text-base truncate pr-4 flex-1">
                        {nodeLabel || 'Conversation'}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <ShareLinkButton
                            chatId={chatId}
                            nodeId={nodeId}
                            size="lg"
                        />
                        <QuickFeedback
                            context="component"
                            componentName="node_modal"
                            popoverPosition="bottom"
                            size="lg"
                        />
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                </div>

                {/* Notch + Gist Content Container - matching ChatSidebar pattern */}
                {!isRootNode && (
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
                                            nodeLabel={nodeLabel || "Current Topic"}
                                            onClose={() => { }}
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
                            onToggle={handleToggleGist}
                            onDownload={handleDownloadBrief}
                        />
                    </div>
                )}

                {/* Main Content Area (Stacking Context) */}
                <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">

                    {/* Chat Layer (Takes remaining space) */}
                    <div className="flex-1 min-h-0 flex flex-col bg-white relative">
                        {/* Scrollable content */}
                        <div
                            className="flex-1 overflow-y-auto overflow-x-hidden p-5 text-sm text-slate-700 leading-relaxed"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                        >
                            <MessageList
                                nodes={conversationNodes}
                                activeNodeId={nodeId}
                                showNodeLabels={false}
                                isStreaming={isStreaming}
                                streamUserMessage={streamUserMessage}
                                statusMessage={statusMessage}
                                directionNodes={directionNodes}
                                onDirectionClick={onDirectionClick}
                                loadingNodeIds={loadingNodeIds}
                            />
                        </div>

                        {/* Chat input */}
                        {onSendMessage && (
                            <ChatInput
                                onSendMessage={onSendMessage}
                                isStreaming={isStreaming}
                                statusMessage={statusMessage}
                                size="lg"
                                inputRef={inputRef}
                                className="border-t border-slate-100"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
