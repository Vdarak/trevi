"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Citation } from '@/lib/api';

/**
 * Citation tooltip with portal - escapes overflow containers for proper positioning.
 */
function SmartCitationTooltip({
    index,
    title,
    content,
    url
}: {
    index: string;
    title: string;
    content: string;
    url?: string;
}) {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number; side: 'top' | 'bottom'; ready: boolean } | null>(null);
    const [mounted, setMounted] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Only render portal on client side
    useEffect(() => {
        setMounted(true);
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, []);

    // Handle hover with debounce
    const handleMouseEnter = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        // Debounce hide by 150ms so user can move to tooltip
        hideTimeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            setPosition(null);
        }, 150);
    };

    // Calculate position when tooltip becomes visible
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

        // Try above first
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

        // Use requestAnimationFrame to ensure we set ready after the browser has painted
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
            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors" style={{ verticalAlign: 'center' }}>
                {index}
            </span>
            {/* Tooltip rendered via portal to escape overflow containers */}
            {mounted && isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    className="fixed w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden pointer-events-auto"
                    style={{
                        // Render off-screen initially for measurement, then move to position
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
                        className="overflow-y-auto px-3 py-2 text-[11px] text-slate-700 leading-relaxed"
                        style={{ maxHeight: '140px', scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                    >
                        <div dangerouslySetInnerHTML={{ __html: formatSnippetContent(content) }} />
                    </div>
                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5">
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

// Helper function to find snippet for a citation
function findSnippetForCitation(citationIndex: number, citations?: Citation[]): string | null {
    if (!citations) return null;

    // Find the citation with matching index
    const citation = citations.find(c => c.index === citationIndex);
    if (!citation || !citation.occurrences || citation.occurrences.length === 0) {
        return null;
    }

    // Return the snippet from the first occurrence
    const snippet = citation.occurrences[0].snippet;
    return snippet && snippet !== "Source paragraph not found" ? snippet : null;
}

/**
 * Format snippet content for citation tooltip display.
 * Handles bold text and converts newlines to paragraphs.
 */
function formatSnippetContent(content: string): string {
    return content
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Bold text
        .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
        // Convert double newlines to paragraphs
        .replace(/\n\n/g, '</p><p class="mt-2">')
        // Single newlines to breaks
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

interface MarkdownRendererProps {
    content: string;
    citations?: Citation[];
}

/**
 * Shared Markdown Renderer Component
 * Renders markdown content with styled headers, lists, blockquotes, code blocks,
 * and intelligent citation tooltips.
 */
export function MarkdownRenderer({ content, citations }: MarkdownRendererProps) {
    let processedText = content;

    // FIRST: Handle standalone reference numbers [n] BEFORE other processing
    // This prevents them from being captured by other patterns
    processedText = processedText.replace(/\[\s*(\d+)\s*\]/g, '__REF_$1__');

    // SECOND: Protect markdown links by replacing them with placeholders
    const links: { text: string; url: string }[] = [];
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        links.push({ text, url });
        return `__LINK_${links.length - 1}__`;
    });

    // THIRD: Extract citations [index: title] - must have colon
    // Also remove any parenthesized URL immediately following the citation
    const extractedCitations: { index: string; title: string }[] = [];
    processedText = processedText.replace(/\[(\d+):\s*([^\]]+)\](?:\s*\([^)]+\))?/g, (match, index, title) => {
        extractedCitations.push({ index, title: title.trim() });
        return `__CITATION_${extractedCitations.length - 1}__`;
    });

    // Also strip any remaining standalone parenthesized URLs (http/https links in parentheses)
    processedText = processedText.replace(/\s*\(https?:\/\/[^)]+\)/g, '');

    // FOURTH: Restore standalone reference numbers as styled bubbles
    processedText = processedText.replace(/__REF_(\d+)__/g, '<span class="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-medium bg-blue-100 text-blue-700 rounded cursor-pointer" style="vertical-align: super; margin: 0 1px;">$1</span>');

    // Apply markdown transformations with Updated Header Styles
    processedText = processedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // UPDATED: Bigger and Bolder Headers
        .replace(/^### (.*$)/gm, '<h4 class="text-base font-bold text-slate-900 mt-4 mb-2">$1</h4>')
        .replace(/^## (.*$)/gm, '<h3 class="text-lg font-bold text-slate-900 mt-5 mb-3">$1</h3>')
        .replace(/^# (.*$)/gm, '<h2 class="text-xl font-bold text-slate-900 mt-6 mb-4">$1</h2>')
        .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-blue-400 pl-3 italic text-slate-600 my-2">$1</blockquote>')
        .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
        .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');

    // FOURTH: Restore links with proper HTML
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        processedText = processedText.replace(
            `__LINK_${i}__`,
            `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${link.text}</a>`
        );
    }

    // If no citations, use simple HTML rendering
    if (extractedCitations.length === 0) {
        return <span className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedText }} />;
    }

    // Split by citation placeholders and interleave with citation components
    const parts = processedText.split(/__CITATION_(\d+)__/);
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            if (parts[i]) {
                elements.push(
                    <span key={`text-${i}`} className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: parts[i] }} />
                );
            }
        } else {
            const citationArrayIndex = parseInt(parts[i], 10);
            const citation = extractedCitations[citationArrayIndex];
            if (citation) {
                const citationNumber = parseInt(citation.index, 10);
                const snippet = findSnippetForCitation(citationNumber, citations);
                const tooltipContent = snippet || citation.title;
                // Find URL from citations data
                const citationData = citations?.find(c => c.index === citationNumber);
                const citationUrl = citationData?.url;

                elements.push(
                    <SmartCitationTooltip
                        key={`cite-${i}`}
                        index={citation.index}
                        title={citation.title}
                        content={tooltipContent}
                        url={citationUrl}
                    />
                );
            }
        }
    }

    return <>{elements}</>;
}
