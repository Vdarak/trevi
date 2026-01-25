"use client";

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Citation } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';

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

/**
 * Format snippet content for citation tooltip display.
 * Handles bold text and converts newlines to paragraphs.
 */
export function formatSnippetContent(content: string): string {
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



// ----------------------------------------------------------------------

interface CitationTrayProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
    url?: string;
}

function CitationTray({ isOpen, onClose, title, content, url }: CitationTrayProps) {
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        // Try to find the sidebar container first, fallback to body
        const sidebarContainer = document.getElementById('chat-sidebar-container');
        setContainer(sidebarContainer || document.body);
    }, [isOpen]); // Re-check when opening

    if (!container) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - absolute within the container */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 z-[100]"
                    />

                    {/* Tray - slides up from bottom of container */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute bottom-0 left-0 right-0 z-[101] bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[60%] border-t border-slate-100 max-w-6xl mx-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 font-semibold text-sm text-slate-800 truncate pr-4 hover:text-blue-600 transition-colors flex items-center gap-2"
                            >
                                <span className="truncate">{title}</span>
                                <svg className="w-3.5 h-3.5 opacity-40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                            <button
                                onClick={onClose}
                                className="p-1.5 -mr-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto px-5 py-4 overscroll-contain">
                            <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed text-slate-600 text-[13px]">
                                <div dangerouslySetInnerHTML={{ __html: formatSnippetContent(content) }} />
                            </div>
                        </div>

                        {/* Footer / Fade */}
                        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        container
    );
}

// ----------------------------------------------------------------------

/**
 * SmartCitationTooltip - The main citation component used in Markdown rendering.
 * Features:
 * - Portal-based tooltip for mouse users
 * - Bottom slide-up Tray for touch users
 * - Intelligent positioning
 */
export function SmartCitationTooltip({
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

    // State
    const [isVisible, setIsVisible] = useState(false);
    const [isTrayOpen, setIsTrayOpen] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number; side: 'top' | 'bottom'; ready: boolean } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isTouch, setIsTouch] = useState(false);

    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize
    useEffect(() => {
        setMounted(true);
        // Detect touch capability
        const mediaQuery = window.matchMedia('(pointer: coarse)');
        setIsTouch(mediaQuery.matches);

        // Listen for changes (e.g. plugging in a mouse vs detaching keyboard/trackpad)
        const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
        mediaQuery.addEventListener('change', handler);

        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            mediaQuery.removeEventListener('change', handler);
        };
    }, []);

    // --- MOUSE INTERACTIONS (Tooltip) ---

    const handleMouseEnter = () => {
        if (isTouch) return; // Ignore hover on touch devices to prevent stuck tooltips
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        if (isTouch) return;
        hideTimeoutRef.current = setTimeout(() => {
            setIsVisible(false);
            setPosition(null);
        }, 150);
    };

    // Calculate tooltip position
    useLayoutEffect(() => {
        if (!isVisible || !triggerRef.current || !tooltipRef.current || isTouch) return;

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
    }, [isVisible, isTouch]);


    // --- CLICK HANDLING ---

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent bubbling causing issues

        if (isTouch) {
            // Touch device -> Open Tray
            setIsTrayOpen(true);
            setIsVisible(false); // Close tooltip if open
        } else {
            // Mouse device -> Open URL
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        }
    }, [isTouch, url]);

    return (
        <>
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

                {/* Desktop Tooltip (Portal) */}
                {mounted && isVisible && !isTouch && createPortal(
                    <div
                        ref={tooltipRef}
                        className="fixed w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden pointer-events-auto"
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

            {/* Mobile Tray (Portal managed internally by component) */}
            {mounted && (
                <CitationTray
                    isOpen={isTrayOpen}
                    onClose={() => setIsTrayOpen(false)}
                    title={title}
                    content={content}
                    url={url}
                />
            )}
        </>
    );
}
