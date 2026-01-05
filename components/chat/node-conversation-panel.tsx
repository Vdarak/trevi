"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2 } from 'lucide-react';
import type { MessagePayload, Citation } from '@/lib/api';

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
                <h3 className="font-semibold text-slate-800 text-sm truncate pr-4 flex-1">
                    {nodeLabel || 'Conversation'}
                </h3>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Scrollable content */}
            <div 
                className="flex-1 overflow-y-auto overflow-x-hidden p-4 text-sm text-slate-700 leading-relaxed"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
            >
                <ContentWithCitations content={aiContent} citations={citations} />
            </div>

            {/* Chat input */}
            {onSendMessage && (
                <div className="border-t border-slate-100 p-3 bg-white flex-shrink-0">
                    {isStreaming && statusMessage && (
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>{statusMessage}</span>
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
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || isStreaming}
                            className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                        >
                            {isStreaming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
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
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div 
                    className="flex-1 overflow-y-auto overflow-x-hidden p-5 text-sm text-slate-700 leading-relaxed"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                >
                    <ContentWithCitations content={aiContent} citations={citations} />
                </div>

                {/* Chat input */}
                {onSendMessage && (
                    <div className="border-t border-slate-100 p-4 bg-white flex-shrink-0">
                        {isStreaming && statusMessage && (
                            <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{statusMessage}</span>
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
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Portal-based citation tooltip for intelligent positioning
 */
function CitationTooltip({
    index,
    content,
    title,
    url
}: {
    index: string;
    content: string;
    title?: string;
    url?: string;
}) {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number; side: 'top' | 'bottom'; ready: boolean } | null>(null);
    const [mounted, setMounted] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setMounted(true);
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, []);

    const handleMouseEnter = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsVisible(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        hideTimeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            setPosition(null);
        }, 150);
    }, []);

    useLayoutEffect(() => {
        if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 8;
        const offset = 6;

        let x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        let y: number;
        let side: 'top' | 'bottom' = 'top';

        const topY = triggerRect.top - tooltipRect.height - offset;
        const bottomY = triggerRect.bottom + offset;

        if (topY >= padding) {
            y = topY;
            side = 'top';
        } else if (bottomY + tooltipRect.height <= vh - padding) {
            y = bottomY;
            side = 'bottom';
        } else {
            const spaceAbove = triggerRect.top;
            const spaceBelow = vh - triggerRect.bottom;
            if (spaceAbove >= spaceBelow) {
                y = padding;
                side = 'top';
            } else {
                y = vh - tooltipRect.height - padding;
                side = 'bottom';
            }
        }

        x = Math.max(padding, Math.min(x, vw - tooltipRect.width - padding));

        requestAnimationFrame(() => {
            setPosition({ x, y, side, ready: true });
        });
    }, [isVisible]);

    const handleClick = useCallback(() => {
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [url]);

    return (
        <span
            ref={triggerRef}
            className="cursor-pointer"
            style={{ verticalAlign: 'bottom', display: 'inline', margin: '0 1px' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors" style={{ verticalAlign: 'middle' }}>
                {index}
            </span>
            {mounted && isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    className="fixed w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden pointer-events-auto"
                    style={{
                        left: position?.ready ? position.x : -9999,
                        top: position?.ready ? position.y : -9999,
                        zIndex: 99999,
                        opacity: position?.ready ? 1 : 0,
                        transform: position?.ready
                            ? 'scale(1) translateY(0)'
                            : `scale(0.95) translateY(${position?.side === 'bottom' ? '-4px' : '4px'})`,
                        transition: position?.ready ? 'opacity 150ms ease-out, transform 150ms ease-out' : 'none',
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div
                        className="overflow-y-auto p-3 text-xs text-slate-600 leading-relaxed"
                        style={{ maxHeight: '144px', scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                    >
                        {content}
                    </div>
                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1">
                        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span className="text-[10px] text-slate-500 truncate font-medium">{title}</span>
                    </div>
                </div>,
                document.body
            )}
        </span>
    );
}

/**
 * Renders content with inline citation badges and portal-based tooltips
 */
function ContentWithCitations({ content, citations }: { content: string; citations?: Citation[] }) {
    // Parse citations from content [n: title] format AND standalone [n] format
    const parts = useMemo(() => {
        const result: Array<{ type: 'text' | 'citation' | 'ref'; value: string; index?: string; title?: string }> = [];

        // First, handle standalone [n] references by replacing them with placeholders
        let processedContent = content.replace(/\[\s*(\d+)\s*\]/g, '__REF_$1__');

        // Match citations like [1: Source Title]
        const regex = /\[(\d+):\s*([^\]]+)\]/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(processedContent)) !== null) {
            // Add text before citation
            if (match.index > lastIndex) {
                result.push({ type: 'text', value: processedContent.slice(lastIndex, match.index) });
            }
            // Add citation
            result.push({
                type: 'citation',
                value: match[0],
                index: match[1],
                title: match[2].trim()
            });
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < processedContent.length) {
            result.push({ type: 'text', value: processedContent.slice(lastIndex) });
        }

        return result;
    }, [content]);

    // Find snippet for a citation index
    const getSnippet = (index: string): string | null => {
        if (!citations) return null;
        const citation = citations.find(c => c.index === parseInt(index, 10));
        if (!citation?.occurrences?.[0]?.snippet) return null;
        const snippet = citation.occurrences[0].snippet;
        return snippet !== "Source paragraph not found" ? snippet : null;
    };

    // Get URL for a citation index
    const getUrl = (index: string): string | undefined => {
        if (!citations) return undefined;
        const citation = citations.find(c => c.index === parseInt(index, 10));
        return citation?.url;
    };

    // Get title for a citation index
    const getTitle = (index: string): string | undefined => {
        if (!citations) return undefined;
        const citation = citations.find(c => c.index === parseInt(index, 10));
        return citation?.title;
    };

    return (
        <div className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                if (part.type === 'text') {
                    // Process __REF_n__ placeholders in text
                    const textWithRefs = part.value.split(/(__REF_\d+__)/g);
                    return textWithRefs.map((segment, j) => {
                        const refMatch = segment.match(/__REF_(\d+)__/);
                        if (refMatch) {
                            const refIndex = refMatch[1];
                            const url = getUrl(refIndex);
                            const snippet = getSnippet(refIndex);
                            const title = getTitle(refIndex);
                            const tooltipContent = snippet || title || 'Source';
                            return (
                                <CitationTooltip
                                    key={`${i}-${j}`}
                                    index={refIndex}
                                    content={tooltipContent}
                                    title={title}
                                    url={url}
                                />
                            );
                        }
                        return <span key={`${i}-${j}`} dangerouslySetInnerHTML={{ __html: formatText(segment) }} />;
                    });
                }

                // Citation with tooltip
                const snippet = getSnippet(part.index!);
                const tooltipContent = snippet || part.title || 'Source';
                const url = getUrl(part.index!);

                return (
                    <CitationTooltip
                        key={i}
                        index={part.index!}
                        content={tooltipContent}
                        title={part.title}
                        url={url}
                    />
                );
            })}
        </div>
    );
}

/**
 * Full markdown text formatting with headers, lists, blockquotes, links, etc.
 */
function formatText(text: string): string {
    // First escape HTML
    let result = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Protect markdown links by replacing with placeholders
    const links: { text: string; url: string }[] = [];
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        links.push({ text: linkText, url });
        return `__LINK_${links.length - 1}__`;
    });
    
    // Strip any standalone parenthesized URLs (http/https links in parentheses)
    result = result.replace(/\s*\(https?:\/\/[^)]+\)/g, '');
    
    // Apply markdown transformations
    result = result
        // Bold and italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Headers (process each line)
        .replace(/^### (.*)$/gm, '<h4 class="font-semibold text-slate-900 mt-3 mb-1.5 text-sm">$1</h4>')
        .replace(/^## (.*)$/gm, '<h3 class="font-semibold text-slate-900 mt-3 mb-1.5">$1</h3>')
        .replace(/^# (.*)$/gm, '<h2 class="font-bold text-slate-900 mt-3 mb-1.5">$1</h2>')
        // Blockquotes
        .replace(/^&gt; (.*)$/gm, '<blockquote class="border-l-4 border-blue-400 pl-3 italic text-slate-600 my-2">$1</blockquote>')
        // Unordered lists
        .replace(/^- (.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
        // Ordered lists (numbered)
        .replace(/^\d+\. (.*)$/gm, '<li class="ml-4 list-decimal">$1</li>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr class="my-3 border-slate-200">')
        // Line breaks (but not after block elements)
        .replace(/\n(?!<\/?(h[1-4]|blockquote|li|hr))/g, '<br>');
    
    // Wrap consecutive list items in ul/ol
    result = result.replace(/(<li class="ml-4 list-disc">.*?<\/li>(?:<br>)?)+/g, '<ul class="my-2">$&</ul>');
    result = result.replace(/(<li class="ml-4 list-decimal">.*?<\/li>(?:<br>)?)+/g, '<ol class="my-2">$&</ol>');
    
    // Restore links with proper HTML
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        result = result.replace(
            `__LINK_${i}__`,
            `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${link.text}</a>`
        );
    }
    
    return result;
}


