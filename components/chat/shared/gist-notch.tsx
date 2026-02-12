"use client";

import React from 'react';
import { ScrollText, Download, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GistNotchProps {
    /** Whether the gist panel is currently open/visible */
    isOpen: boolean;
    /** Whether gist data is currently being fetched */
    isLoading: boolean;
    /** Whether gist PDF is being downloaded */
    isDownloading: boolean;
    /** Whether gist data has already been fetched */
    hasData: boolean;
    /** Whether this is a root node (hides the notch entirely) */
    isRootNode?: boolean;
    /** Toggle the gist panel open/closed */
    onToggle: () => void;
    /** Download the gist as PDF */
    onDownload: () => void;
    /** Additional classes for the outer container */
    className?: string;
}

/**
 * GistNotch - A floating notch container with the Gist toggle button.
 * 
 * Positioned absolutely to float below the header/title bar.
 * Used consistently across ChatSidebar, ShareChatView, and NodeConversationModal.
 * 
 * Layout:
 * ┌─ Header/Title border ─────────────────────┐
 *     ╭──────────────╮
 *     │ ✨ Gist  [⬇] │ ← rounded bottom, floats over content
 *     ╰──────────────╯
 */
export function GistNotch({
    isOpen,
    isLoading,
    isDownloading,
    hasData,
    isRootNode = false,
    onToggle,
    onDownload,
    className,
}: GistNotchProps) {
    // Don't render for root nodes
    if (isRootNode) return null;

    return (
        <div className={cn("flex-shrink-0 relative", className)}>
            {/* Notch Frame - positioned to float over content */}
            <div
                className="absolute left-0 right-0 bottom-0 flex justify-start pl-4 pointer-events-none"
                style={{ transform: 'translateY(100%)', zIndex: 10 }}
            >
                <div className="relative pointer-events-auto">
                    <div className={cn(
                        "relative",
                        "rounded-b-xl",
                        "bg-slate-50",
                        "border-x border-b border-slate-200",
                        "shadow-sm"
                    )}>
                        {/* Inner content area - compact */}
                        <div className="flex flex-col items-center py-1.5 px-1.5">
                            {/* Button group container */}
                            <div className="relative flex items-center">
                                {/* Main Gist Button */}
                                <button
                                    onClick={onToggle}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 transition-all duration-200 border text-xs font-semibold select-none",
                                        isOpen ? "rounded-l-lg" : "rounded-lg",
                                        isLoading
                                            ? "bg-blue-500 text-white border-blue-600"
                                            : isOpen
                                                ? "bg-blue-700 text-white border-blue-800 shadow-inner"
                                                : hasData
                                                    ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800"
                                                    : "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:border-blue-800"
                                    )}
                                    title={isLoading ? "Generating..." : hasData ? "Gist Generated" : isOpen ? "Close Gist" : "View Gist"}
                                >
                                    {isLoading ? (
                                        <motion.span
                                            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                            className="flex items-center justify-center"
                                        >
                                            <ScrollText className="w-4 h-4 text-white" />
                                        </motion.span>
                                    ) : hasData ? (
                                        <motion.span
                                            animate={{ rotate: isOpen ? -10 : 0 }}
                                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                                            className="flex items-center justify-center"
                                        >
                                            <ScrollText className="w-4 h-4 text-white" />
                                        </motion.span>
                                    ) : (
                                        <ScrollText className="w-4 h-4 text-white" />
                                    )}
                                    <span>Gist</span>
                                </button>

                                {/* Download Button - animated reveal when Gist is open */}
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.button
                                            initial={{ width: 0, opacity: 0, paddingLeft: 0, paddingRight: 0 }}
                                            animate={{ width: 'auto', opacity: 1, paddingLeft: 10, paddingRight: 10 }}
                                            exit={{ width: 0, opacity: 0, paddingLeft: 0, paddingRight: 0 }}
                                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                                            onClick={onDownload}
                                            disabled={isLoading || isDownloading}
                                            className={cn(
                                                "flex items-center justify-center py-1.5 rounded-r-lg border border-l-0 text-xs font-semibold select-none transition-colors overflow-hidden",
                                                isLoading
                                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                    : isDownloading
                                                        ? "bg-blue-50 text-blue-600 border-blue-200 shadow-inner cursor-wait"
                                                        : "bg-white text-blue-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300"
                                            )}
                                            title={isLoading ? "Generating gist..." : isDownloading ? "Downloading..." : "Download Brief as PDF"}
                                        >
                                            {isDownloading ? (
                                                <Loader2 className="w-4 h-4 flex-shrink-0 text-blue-600 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4 flex-shrink-0 text-blue-600" />
                                            )}
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
