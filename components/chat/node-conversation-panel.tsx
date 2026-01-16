"use client";

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { X, Send } from 'lucide-react';
import type { MessagePayload, Citation } from '@/lib/api';
import { StatusLine } from '@/components/ui/status-line';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { QuickFeedback } from '@/components/feedback/quick-feedback';

interface NodeConversationPanelProps {
    isOpen: boolean;
    messages: MessagePayload[];
    nodeLabel?: string;
    onClose: () => void;
    citations?: Citation[];
    onSendMessage?: (message: string) => void;
    isStreaming?: boolean;
    statusMessage?: string;
    clickPosition?: { x: number; y: number }; // For modal animation origin
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
}: NodeConversationPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

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
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

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
            className="w-[400px] max-h-[60vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in flex flex-col"
        >
            {/* Header with title and close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                <h3 className="font-semibold text-slate-800 text-sm truncate pr-2 flex-1">
                    {nodeLabel || 'Conversation'}
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <QuickFeedback
                        context="component"
                        componentName="node_panel"
                        popoverPosition="bottom"
                        size="sm"
                    />
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

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
                                {statusMessage}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Chat input */}
            {onSendMessage && (
                <div className="border-t border-slate-100 p-3 bg-white flex-shrink-0">
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
    clickPosition,
}: NodeConversationPanelProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

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
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

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
                className="w-full h-full md:h-auto md:max-w-2xl md:max-h-[70vh] bg-white md:rounded-2xl shadow-2xl md:border border-slate-200 overflow-hidden flex flex-col"
                style={{
                    animation: 'modal-scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    transformOrigin
                }}
            >
                {/* Header with title and close button */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                    <h3 className="font-semibold text-slate-800 text-base truncate pr-4 flex-1">
                        {nodeLabel || 'Conversation'}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <QuickFeedback
                            context="component"
                            componentName="node_modal"
                            popoverPosition="bottom"
                            size="sm"
                        />
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

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
                                    {statusMessage}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat input */}
                {onSendMessage && (
                    <div className="border-t border-slate-100 p-4 bg-white flex-shrink-0">
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
    );
}




