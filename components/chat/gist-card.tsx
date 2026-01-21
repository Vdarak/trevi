"use client";

import React from 'react';
import { Sparkle, Quote } from 'lucide-react';
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

    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            // Only capture vertical scrolling (deltaY) and translate it to horizontal
            if (e.deltaY !== 0 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                container.scrollBy({
                    left: e.deltaY,
                    behavior: 'auto'
                });
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    // Show loading state
    if (isLoading) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full max-w-full bg-slate-50 border-b border-blue-100 p-12", className)}>
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
            <div className={cn("flex flex-col items-center justify-center w-full max-w-full bg-slate-50 border-b border-blue-100 p-12", className)}>
                <Sparkle className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-sm text-slate-400 font-medium">No Gist available</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col w-full max-w-full bg-slate-50 border-b border-blue-100", className)}>
            {/* Horizontal Scroll Area */}
            <div
                ref={scrollContainerRef}
                className="flex gap-4 p-4 w-full overflow-x-auto scroll-smooth scrollbar-thin items-stretch snap-x snap-proximity overscroll-x-contain"
            >

                {/* Summary Card (tldr) - First Card with Blue Title */}
                <div className="min-w-[320px] w-[320px] flex-shrink-0 snap-center bg-white rounded-xl border border-blue-200 shadow-sm p-4 flex flex-col relative overflow-hidden">
                    <h3 className="relative text-xs font-bold text-blue-600 mb-3 pb-2 border-b border-slate-100">Summary</h3>
                    <div className="relative text-xs text-slate-900 leading-relaxed overflow-y-auto max-h-[180px] scrollbar-thin">
                        <MarkdownRenderer content={briefData.tldr} />
                    </div>
                </div>

                {/* Node Summary Cards - Black Titles */}
                {Object.entries(briefData.node_summaries).map(([nodeTitle, summary], idx) => (
                    <div
                        key={idx}
                        className="min-w-[300px] w-[300px] flex-shrink-0 snap-center bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col"
                    >
                        <h4 className="font-bold text-xs text-slate-900 mb-3 pb-2 border-b border-slate-100">
                            {nodeTitle}
                        </h4>
                        <div className="flex-1 text-xs text-slate-900 leading-relaxed overflow-y-auto max-h-[160px] scrollbar-thin">
                            <MarkdownRenderer content={summary} />
                        </div>
                    </div>
                ))}

                {/* Key Topics Card - Last card with topics on new lines */}
                {briefData.key_topics && briefData.key_topics.length > 0 && (
                    <div className="min-w-[300px] w-[300px] flex-shrink-0 snap-center bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
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

                {/* End Spacer */}
                <div className="w-2 flex-shrink-0" />
            </div>
        </div>
    );
}
