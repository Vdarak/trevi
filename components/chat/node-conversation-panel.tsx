"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { X, Info } from 'lucide-react';
import type { MessagePayload, Citation } from '@/lib/api';

interface NodeConversationPanelProps {
    isOpen: boolean;
    messages: MessagePayload[];
    nodeLabel?: string;
    onClose: () => void;
    citations?: Citation[];
}

/**
 * An information panel that displays AI responses for a node.
 * Clean, reading-focused design - not a chat interface.
 */
export function NodeConversationPanel({
    isOpen,
    messages,
    nodeLabel,
    onClose,
    citations,
}: NodeConversationPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Filter to only assistant messages
    const assistantMessages = useMemo(() =>
        messages.filter(msg => msg.role === 'assistant'),
        [messages]
    );

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

    if (!isOpen || assistantMessages.length === 0) return null;

    return (
        <div
            ref={panelRef}
            className="w-[400px] max-h-[60vh] bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col animate-fade-in overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    <h3 className="font-semibold text-slate-800 text-sm truncate max-w-[280px]">
                        {nodeLabel || 'Response'}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content - Clean typography for reading */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
                {assistantMessages.map((msg, index) => (
                    <article
                        key={index}
                        className="prose prose-slate prose-sm max-w-none
                            prose-headings:font-semibold prose-headings:text-slate-800
                            prose-p:text-slate-600 prose-p:leading-relaxed
                            prose-strong:text-slate-700
                            prose-ul:text-slate-600 prose-ol:text-slate-600
                            prose-li:marker:text-slate-400
                            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                            prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50/50 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic
                            prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-700 prose-code:before:content-none prose-code:after:content-none
                        "
                    >
                        <div
                            dangerouslySetInnerHTML={{
                                __html: renderMarkdownToHtml(msg.content)
                            }}
                        />
                    </article>
                ))}
            </div>
        </div>
    );
}

/**
 * Simple markdown to HTML renderer for information display.
 * Handles basic formatting: bold, italic, headers, lists, code, links.
 */
function renderMarkdownToHtml(markdown: string): string {
    let html = markdown
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Headers (### -> h3, ## -> h2, etc)
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        // Ordered lists (basic)
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Blockquotes
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Paragraphs (double newline)
        .replace(/\n\n/g, '</p><p>')
        // Single newlines to <br> within paragraphs (optional, can remove if unwanted)
        .replace(/\n/g, '<br>');

    // Wrap in paragraph if not starting with a block element
    if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<blockquote')) {
        html = '<p>' + html + '</p>';
    }

    return html;
}

