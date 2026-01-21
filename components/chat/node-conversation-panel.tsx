"use client";

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { X, Send, Sparkle, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MessagePayload, Citation, TreviBriefResponse } from '@/lib/api';
import { fetchTreviBrief } from '@/lib/api';
import type { BriefState } from '@/components/graph/types';
import { StatusLine } from '@/components/ui/status-line';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { QuickFeedback } from '@/components/feedback/quick-feedback';
import { cn } from '@/lib/utils';
import { GistCard } from '@/components/chat/gist-card';

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
}: NodeConversationPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const [showGist, setShowGist] = useState(false);

    // Trevi Brief states - derived from cache
    const briefState = nodeId ? briefCache?.get(nodeId) : undefined;
    const briefData = briefState?.data || null;
    const isBriefLoading = briefState?.isLoading || false;
    const briefConnectionRef = useRef<AbortController | null>(null);

    // Reset showBrief when switching nodes in modal
    React.useEffect(() => {
        if (nodeId) {
            if (isRootNode) setShowGist(false);
        }
    }, [nodeId, isRootNode]);

    // Filter to only assistant messages and combine them
    const aiContent = useMemo(() => {
        const assistantMessages = messages.filter(msg => msg.role === 'assistant');
        return assistantMessages.map(m => m.content).join('\n\n');
    }, [messages]);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isStreaming && onSendMessage) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    if (!isOpen || !aiContent) return null;

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
                    {!isRootNode && (
                        <>
                            <button
                                onClick={() => {
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
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 border text-xs font-semibold select-none",
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
                                    <Sparkle className="w-3.5 h-3.5 fill-blue-500" />
                                )}
                                <span>Gist</span>
                            </button>

                            <div className="w-px h-4 bg-slate-200 mx-1" />
                        </>
                    )}

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

            {/* Main Content Area (Stacking Context) */}
            <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">

                {/* Trevi Brief Section (Shifts content down) */}
                <AnimatePresence>
                    {showGist && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="flex-shrink-0 w-full min-w-0 overflow-hidden z-10 bg-white shadow-sm relative border-b border-blue-100"
                        >
                            <GistCard
                                nodeLabel={nodeLabel || "Current Topic"}
                                onClose={() => setShowGist(false)}
                                className="border-none"
                                isLoading={isBriefLoading}
                                briefData={briefData}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Chat Layer (Takes remaining space) */}
                <div className="flex-1 min-h-0 flex flex-col bg-white relative">
                    {/* Scrollable content */}
                    <div
                        className="flex-1 overflow-y-auto overflow-x-hidden p-4 text-sm text-slate-700 leading-relaxed"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                    >
                        <MarkdownRenderer content={aiContent} citations={citations} />

                        {/* Optimistic User Message */}
                        {isStreaming && (
                            <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
                                <div className="flex flex-col gap-1 items-end">
                                    <div className="bg-slate-100 text-slate-800 px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                                        {streamUserMessage || statusMessage}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat input */}
                    {onSendMessage && (
                        <div className="border-t border-slate-100 p-3 bg-white flex-shrink-0 z-20">
                            {isStreaming && (
                                <div className="mb-2 animate-fade-in">
                                    <StatusLine
                                        status="exploring"
                                        title="Exploring"
                                        subtitle={statusMessage || "Processing..."}
                                    />
                                </div>
                            )}
                            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Ask a follow-up..."
                                    disabled={isStreaming}
                                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isStreaming}
                                    className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                                >
                                    {isStreaming ? (
                                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-white animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </button>
                            </form>
                        </div>
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
}: NodeConversationPanelProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const [showGist, setShowGist] = useState(false);

    // Trevi Brief states - derived from cache
    const briefState = nodeId ? briefCache?.get(nodeId) : undefined;
    const briefData = briefState?.data || null;
    const isBriefLoading = briefState?.isLoading || false;
    const briefConnectionRef = useRef<AbortController | null>(null);

    // Reset showBrief when switching nodes in modal
    React.useEffect(() => {
        if (nodeId) {
            if (isRootNode) setShowGist(false);
        }
    }, [nodeId, isRootNode]);

    // Calculate transform origin based on click position
    const transformOrigin = useMemo(() => {
        if (!clickPosition) return 'center center';
        // Convert screen position to percentage relative to viewport
        const xPercent = (clickPosition.x / window.innerWidth) * 100;
        const yPercent = (clickPosition.y / window.innerHeight) * 100;
        return `${xPercent}% ${yPercent}%`;
    }, [clickPosition]);

    // Filter to only assistant messages and combine them
    const aiContent = useMemo(() => {
        const assistantMessages = messages.filter(msg => msg.role === 'assistant');
        return assistantMessages.map(m => m.content).join('\n\n');
    }, [messages]);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isStreaming && onSendMessage) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen || !aiContent) return null;

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
                        {/* Trevi Brief Toggle - hidden for root nodes */}
                        {!isRootNode && (
                            <>
                                <button
                                    onClick={() => {
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
                                    }}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 border text-xs font-semibold select-none",
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

                                <div className="w-px h-5 bg-slate-200 mx-1" />
                            </>
                        )}

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

                {/* Main Content Area (Stacking Context) */}
                <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">

                    {/* Trevi Brief Section (Shifts content down) */}
                    <AnimatePresence>
                        {showGist && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="flex-shrink-0 overflow-hidden z-10 bg-white shadow-sm relative border-b border-blue-100"
                            >
                                <GistCard
                                    nodeLabel={nodeLabel || "Current Topic"}
                                    onClose={() => setShowGist(false)}
                                    className="border-none"
                                    isLoading={isBriefLoading}
                                    briefData={briefData}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Chat Layer (Takes remaining space) */}
                    <div className="flex-1 min-h-0 flex flex-col bg-white relative">
                        {/* Scrollable content */}
                        <div
                            className="flex-1 overflow-y-auto overflow-x-hidden p-5 text-sm text-slate-700 leading-relaxed"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                        >
                            <MarkdownRenderer content={aiContent} citations={citations} />

                            {/* Optimistic User Message */}
                            {isStreaming && (
                                <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
                                    <div className="flex flex-col gap-1 items-end">
                                        <div className="bg-slate-100 text-slate-800 px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">
                                            {streamUserMessage || statusMessage}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chat input */}
                        {onSendMessage && (
                            <div className="border-t border-slate-100 p-4 bg-white flex-shrink-0 z-20">
                                {isStreaming && (
                                    <div className="mb-3 animate-fade-in">
                                        <StatusLine
                                            status="exploring"
                                            title="Exploring"
                                            subtitle={statusMessage || "Processing..."}
                                        />
                                    </div>
                                )}
                                <form onSubmit={handleSubmit} className="flex items-center gap-3">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="Ask a follow-up question..."
                                        disabled={isStreaming}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!inputValue.trim() || isStreaming}
                                        className="p-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                                    >
                                        {isStreaming ? (
                                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-white animate-spin" />
                                        ) : (
                                            <Send className="w-5 h-5" />
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}




