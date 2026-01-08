"use client";

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Citation } from '@/lib/api';

/**
 * Helper function to find snippet for a citation
 */
export function findSnippetForCitation(citationIndex: number, citations?: Citation[]): string | null {
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

export interface CitationTooltipGraphProps {
    index: string;
    content: string;
    title?: string;
    url?: string;
}

/**
 * Citation tooltip component - uses portal for proper positioning outside overflow containers
 */
export function CitationTooltipGraph({
    index,
    content,
    title = 'Source',
    url
}: CitationTooltipGraphProps) {
    const triggerRef = useRef<HTMLElement>(null);
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
    const handleMouseEnter = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsVisible(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        // Debounce hide by 150ms so user can move to tooltip
        hideTimeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            setPosition(null);
        }, 150);
    }, []);

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

    // Handle click to open URL
    const handleClick = useCallback(() => {
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [url]);

    return (
        <span
            ref={triggerRef as React.RefObject<HTMLSpanElement>}
            className="cursor-pointer"
            style={{ verticalAlign: 'super', display: 'inline', margin: '0 1px' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[9px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors" style={{ verticalAlign: 'super' }}>
                {index}
            </span>
            {/* Tooltip rendered via portal to escape overflow containers */}
            {mounted && isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    className="fixed w-56 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden pointer-events-auto"
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
                        className="overflow-y-auto px-2.5 py-2 text-[10px] text-slate-700 leading-relaxed"
                        style={{ maxHeight: '120px', scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
                    >
                        {content}
                    </div>
                    <div className="px-2.5 py-1 bg-slate-50 border-t border-slate-100 flex items-center gap-1">
                        <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span className="text-[9px] text-slate-500 truncate font-medium">{title}</span>
                    </div>
                </div>,
                document.body
            )}
        </span>
    );
}
