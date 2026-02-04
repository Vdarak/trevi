"use client";

import React from 'react';
import { Sparkle, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { motion } from 'framer-motion';
import type { TreviBriefResponse } from '@/lib/api';

interface GistCardProps {
    nodeLabel: string;
    onClose: () => void;
    className?: string;
    isLoading?: boolean;
    briefData?: TreviBriefResponse['trevi_brief'] | null;
}

// Loading dots component (similar to LoadingTips)
function LoadingDots() {
    return (
        <span className="inline-flex items-center ml-1">
            <motion.span
                className="w-1 h-1 bg-blue-400 rounded-full mx-0.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
            />
            <motion.span
                className="w-1 h-1 bg-blue-400 rounded-full mx-0.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
            />
            <motion.span
                className="w-1 h-1 bg-blue-400 rounded-full mx-0.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
            />
        </span>
    );
}

export function GistCard({ nodeLabel, onClose, className, isLoading, briefData }: GistCardProps) {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    // Drag-to-scroll state
    const [isDragging, setIsDragging] = React.useState(false);
    const [startX, setStartX] = React.useState(0);
    const [scrollLeft, setScrollLeft] = React.useState(0);

    // Navigation state
    const [canScrollLeft, setCanScrollLeft] = React.useState(false);
    const [canScrollRight, setCanScrollRight] = React.useState(true);
    const [isHovering, setIsHovering] = React.useState(false);

    // Update scroll state
    const updateScrollState = React.useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        setCanScrollLeft(container.scrollLeft > 0);
        setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    }, []);

    // Scroll by card width
    const scrollByCard = React.useCallback((direction: 'left' | 'right') => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const cardWidth = 320; // Card width
        container.scrollBy({
            left: direction === 'left' ? -cardWidth : cardWidth,
            behavior: 'smooth'
        });
    }, []);

    // Mouse drag handlers
    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Only start drag if clicking on the container or its direct children (not scrollable content)
        const target = e.target as HTMLElement;
        if (target.closest('.overflow-y-auto')) return; // Don't drag from scrollable content

        setIsDragging(true);
        setStartX(e.pageX - container.offsetLeft);
        setScrollLeft(container.scrollLeft);
    }, []);

    const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.5; // Multiply for faster scroll
        container.scrollLeft = scrollLeft - walk;
    }, [isDragging, startX, scrollLeft]);

    const handleMouseUp = React.useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseLeave = React.useCallback(() => {
        setIsDragging(false);
        setIsHovering(false);
    }, []);

    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Update scroll state on scroll
        container.addEventListener('scroll', updateScrollState);
        updateScrollState();

        return () => container.removeEventListener('scroll', updateScrollState);
    }, [updateScrollState]);

    // Show loading state
    if (isLoading) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full max-w-full bg-white py-8", className)}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="mb-4"
                >
                    <Sparkle className="w-12 h-12 text-blue-500 fill-blue-500" />
                </motion.div>
                <p className="text-sm text-slate-600 font-medium flex items-center">
                    Generating Gist<LoadingDots />
                </p>
            </div>
        );
    }

    // Show empty state if no data
    if (!briefData) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full max-w-full bg-white py-8", className)}>
                <Sparkle className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-sm text-slate-400 font-medium">No Gist available</p>
            </div>
        );
    }

    return (
        <div
            className={cn("flex flex-col w-full max-w-full bg-white", className)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={handleMouseLeave}
        >
            <div className="relative">
                {/* Left fade gradient - subtle */}
                <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white/60 to-transparent pointer-events-none z-10" />
                {/* Right fade gradient - subtle */}
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/60 to-transparent pointer-events-none z-10" />

                {/* Left navigation arrow */}
                {canScrollLeft && isHovering && (
                    <button
                        onClick={() => scrollByCard('left')}
                        className="absolute ml-4 left-1 top-1/2 -translate-y-1/2 z-20 p-2 rounded bg-white shadow-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                        aria-label="Scroll left"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}

                {/* Right navigation arrow */}
                {canScrollRight && isHovering && (
                    <button
                        onClick={() => scrollByCard('right')}
                        className="absolute mr-4 right-1 top-1/2 -translate-y-1/2 z-20 p-2 rounded bg-white shadow-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                        aria-label="Scroll right"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                )}


                <div
                    ref={scrollContainerRef}
                    className="flex w-full overflow-x-auto scroll-smooth scrollbar-thin items-stretch snap-x snap-proximity overscroll-x-contain"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >

                    {/* Summary Card (tldr) - First Card with Blue Title */}
                    <div className="min-w-[320px] w-[320px] flex-shrink-0 snap-center bg-white p-4 flex flex-col relative overflow-hidden border-r border-slate-200">
                        <h3 className="relative text-xs font-bold text-blue-600 mb-3 pb-2 border-b border-slate-100">Summary</h3>
                        <div className="relative text-xs text-slate-900 leading-relaxed overflow-y-auto max-h-[180px] scrollbar-thin">
                            <MarkdownRenderer content={briefData.tldr.map(item => `- ${item}`).join('\n')} />
                        </div>
                    </div>

                    {/* Node Summary Cards - Black Titles, with right border divider */}
                    {Object.entries(briefData.node_summaries).map(([nodeTitle, summary], idx) => (
                        <div
                            key={idx}
                            className="min-w-[320px] w-[320px] flex-shrink-0 snap-center bg-white p-4 flex flex-col border-r border-slate-200"
                        >
                            <h4 className="font-bold text-xs text-slate-900 mb-3 pb-2 border-b border-slate-100">
                                {nodeTitle}
                            </h4>
                            <div className="flex-1 text-xs text-slate-900 leading-relaxed overflow-y-auto max-h-[160px] scrollbar-thin">
                                <MarkdownRenderer content={summary.map(item => `- ${item}`).join('\n')} />
                            </div>
                        </div>
                    ))}

                    {/* Key Topics Card - Last card, no right border */}
                    {briefData.key_topics && briefData.key_topics.length > 0 && (
                        <div className="min-w-[320px] w-[320px] flex-shrink-0 snap-center bg-white p-4 flex flex-col">
                            <h4 className="font-bold text-xs text-slate-900 mb-3 pb-2 border-b border-slate-100">
                                Key Topics
                            </h4>
                            <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[160px] scrollbar-thin">
                                {briefData.key_topics.map((topic, idx) => (
                                    <span
                                        key={idx}
                                        className="text-blue-600 text-xs font-bold"
                                    >
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
