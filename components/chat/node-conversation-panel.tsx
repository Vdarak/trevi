"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import type { MessagePayload, Citation } from '@/lib/api';

interface NodeConversationPanelProps {
    isOpen: boolean;
    messages: MessagePayload[];
    nodeLabel?: string;
    onClose: () => void;
    citations?: Citation[];
}

/**
 * Minimal scrollable dialog showing AI response with citation tooltips.
 * No chat styling - just clean readable text.
 */
export function NodeConversationPanel({
    isOpen,
    messages,
    nodeLabel,
    onClose,
    citations,
}: NodeConversationPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Filter to only assistant messages and combine them
    const aiContent = useMemo(() => {
        const assistantMessages = messages.filter(msg => msg.role === 'assistant');
        return assistantMessages.map(m => m.content).join('\n\n');
    }, [messages]);

    // Close on escape key or click outside
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('keydown', handleEscape);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen || !aiContent) return null;

    return (
        <div
            ref={panelRef}
            className="w-[380px] max-h-[50vh] bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden animate-fade-in"
        >
            {/* Scrollable content - minimal styling */}
            <div className="overflow-y-auto p-4 text-sm text-slate-700 leading-relaxed">
                <ContentWithCitations content={aiContent} citations={citations} />
            </div>
        </div>
    );
}

/**
 * Renders content with inline citation badges and centered tooltips
 */
function ContentWithCitations({ content, citations }: { content: string; citations?: Citation[] }) {
    // Parse citations from content [n: title] format
    const parts = useMemo(() => {
        const result: Array<{ type: 'text' | 'citation'; value: string; index?: string; title?: string }> = [];

        // Match citations like [1: Source Title]
        const regex = /\[(\d+):\s*([^\]]+)\]/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(content)) !== null) {
            // Add text before citation
            if (match.index > lastIndex) {
                result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
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
        if (lastIndex < content.length) {
            result.push({ type: 'text', value: content.slice(lastIndex) });
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

    return (
        <div className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                if (part.type === 'text') {
                    return <span key={i} dangerouslySetInnerHTML={{ __html: formatText(part.value) }} />;
                }

                // Citation with tooltip
                const snippet = getSnippet(part.index!);
                const tooltipContent = snippet || part.title || 'Source';

                return (
                    <span key={i} className="inline-block relative group">
                        <sup className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-medium bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 transition-colors">
                            {part.index}
                        </sup>
                        {/* Tooltip - centered horizontally, appears above */}
                        <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[99999]">
                            <div className="max-h-36 overflow-y-auto p-3 text-xs text-slate-600 leading-relaxed">
                                {tooltipContent}
                            </div>
                            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 font-medium truncate">
                                {part.title}
                            </div>
                        </div>
                    </span>
                );
            })}
        </div>
    );
}

/**
 * Simple text formatting (bold, italic, etc.)
 */
function formatText(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs">$1</code>')
        .replace(/\n/g, '<br>');
}


