"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ThumbsUp, ThumbsDown, Copy, Check, X, ArrowUp } from 'lucide-react';
import { submitFeedback } from '@/lib/api';

// Preset options for different feedback contexts (6 options each including "Other...")
const PRESETS = {
    liked: {
        response: ["Up to date", "Accurate", "Clear explanation", "Good sources", "Helpful", "Other..."],
        component: ["Easy to use", "Good layout", "Intuitive design", "Useful feature", "Well organized", "Other..."],
        canvas: ["Good visualization", "Clear structure", "Easy to navigate", "Helpful overview", "Well organized", "Other..."],
        general: ["Great experience", "Easy to use", "Very helpful", "Love the features", "Well designed", "Other..."],
    },
    disliked: {
        response: ["Outdated", "Inaccurate", "Not helpful", "Confusing", "Poor sources", "Other..."],
        component: ["Confusing layout", "Hard to navigate", "Too cluttered", "Missing features", "Needs improvement", "Other..."],
        canvas: ["Confusing layout", "Hard to navigate", "Too cluttered", "Missing features", "Needs improvement", "Other..."],
        general: ["Hard to use", "Confusing", "Missing features", "Too slow", "Needs work", "Other..."],
    },
};

type FeedbackContext = "response" | "component" | "canvas" | "general";
type PopoverPosition = "top" | "bottom" | "left" | "right";

interface QuickFeedbackProps {
    /** Context determines which preset options to show */
    context: FeedbackContext;
    /** Component name for API tracking (e.g., "chat_sidebar", "node_panel", "canvas") */
    componentName: string;
    /** Optional node ID if feedback is for a specific response */
    nodeId?: string;
    /** Popover position relative to thumb buttons */
    popoverPosition?: PopoverPosition;
    /** Size variant */
    size?: "sm" | "md" | "lg";
    /** Show copy button alongside thumbs */
    showCopy?: boolean;
    /** Content to copy when copy button is clicked */
    copyContent?: string;
    /** Stack thumbs vertically */
    vertical?: boolean;
    /** Additional class names */
    className?: string;
}

export function QuickFeedback({
    context,
    componentName,
    nodeId,
    popoverPosition = "bottom",
    size = "md",
    showCopy = false,
    copyContent = "",
    vertical = false,
    className = "",
}: QuickFeedbackProps) {
    const [feedbackType, setFeedbackType] = useState<"up" | "down" | null>(null);
    const [showPopover, setShowPopover] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [isOtherMode, setIsOtherMode] = useState(false);
    const [customText, setCustomText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [copied, setCopied] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number; ready: boolean } | null>(null);
    const [hoveredThumb, setHoveredThumb] = useState<"up" | "down" | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Only render portal on client side
    useEffect(() => {
        setMounted(true);
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
        };
    }, []);

    // Handle mouse enter on thumbs with debounce
    const handleThumbMouseEnter = useCallback((type: "up" | "down") => {
        // Clear any pending leave timeout
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }

        setHoveredThumb(type);

        // Debounce: only show popover after 200ms hover
        hoverTimeoutRef.current = setTimeout(() => {
            setSelectedPreset(null);
            setIsOtherMode(false);
            setCustomText("");
            setPosition(null);
            setFeedbackType(type);
            setShowPopover(true);
        }, 200);
    }, []);

    // Handle mouse leave from thumbs
    const handleThumbMouseLeave = useCallback(() => {
        // Clear any pending hover timeout
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        setHoveredThumb(null);

        // Debounce close: give user time to move to popover
        leaveTimeoutRef.current = setTimeout(() => {
            // Only close if not hovering popover
            if (!popoverRef.current?.matches(':hover')) {
                handleClose();
            }
        }, 150);
    }, []);

    // Handle mouse enter on popover
    const handlePopoverMouseEnter = useCallback(() => {
        // Clear any pending leave timeout
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
    }, []);

    // Handle mouse leave from popover
    const handlePopoverMouseLeave = useCallback(() => {
        // Close after leaving popover
        leaveTimeoutRef.current = setTimeout(() => {
            handleClose();
        }, 150);
    }, []);

    // Close popover when clicking outside
    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node) &&
            popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
            handleClose();
        }
    }, []);

    useEffect(() => {
        if (showPopover) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [showPopover, handleClickOutside]);

    // Calculate position when popover becomes visible or feedbackType changes
    useLayoutEffect(() => {
        if (!showPopover || !feedbackType || !containerRef.current || !popoverRef.current) return;

        const triggerRect = containerRef.current.getBoundingClientRect();
        const popoverRect = popoverRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 8;
        const offset = 8;

        let x: number;
        let y: number;

        switch (popoverPosition) {
            case "top":
                x = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;
                y = triggerRect.top - popoverRect.height - offset;
                break;
            case "bottom":
                x = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;
                y = triggerRect.bottom + offset;
                break;
            case "left":
                x = triggerRect.left - popoverRect.width - offset;
                y = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2;
                break;
            case "right":
                x = triggerRect.right + offset;
                y = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2;
                break;
        }

        // Clamp to viewport
        x = Math.max(padding, Math.min(x, vw - popoverRect.width - padding));
        y = Math.max(padding, Math.min(y, vh - popoverRect.height - padding));

        requestAnimationFrame(() => {
            setPosition({ x, y, ready: true });
        });
    }, [showPopover, feedbackType, popoverPosition, isOtherMode, showSuccess]);

    // Focus textarea when entering other mode
    useEffect(() => {
        if (isOtherMode && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOtherMode]);

    const handleClose = () => {
        setShowPopover(false);
        setFeedbackType(null);
        setSelectedPreset(null);
        setIsOtherMode(false);
        setCustomText("");
        setPosition(null);
    };

    const handlePresetClick = async (preset: string) => {
        if (preset === "Other...") {
            setIsOtherMode(true);
            return;
        }

        setSelectedPreset(preset);
        await submitFeedbackToAPI(preset);
    };

    const handleCustomSubmit = async () => {
        if (!customText.trim()) return;
        await submitFeedbackToAPI(customText.trim());
    };

    const submitFeedbackToAPI = async (details: string) => {
        setIsSubmitting(true);
        try {
            await submitFeedback("quick", {
                liked: feedbackType === "up",
                details,
                component: componentName,
                context,
                ...(nodeId && { node_id: nodeId }),
            });

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                handleClose();
            }, 1500);
        } catch (error) {
            console.error("Failed to submit feedback:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!copyContent) return;
        try {
            await navigator.clipboard.writeText(copyContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    const presets = feedbackType
        ? PRESETS[feedbackType === "up" ? "liked" : "disliked"][context]
        : [];

    const iconSize = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
    const buttonSize = size === "sm" ? "p-1" : size === "lg" ? "p-2" : "p-1.5";

    return (
        <div className={`relative inline-flex ${vertical ? "flex-col" : ""} items-center gap-1 ${className}`} ref={containerRef}>
            {/* Thumbs Up Button */}
            <button
                onMouseEnter={() => handleThumbMouseEnter("up")}
                onMouseLeave={handleThumbMouseLeave}
                className={`
                    ${buttonSize} rounded-md transition-all duration-150
                    ${feedbackType === "up" || hoveredThumb === "up"
                        ? "text-green-600 bg-green-50"
                        : "text-green-500 hover:text-green-600 hover:bg-green-50"}
                `}
                title="Like"
            >
                <ThumbsUp className={iconSize} />
            </button>

            {/* Thumbs Down Button */}
            <button
                onMouseEnter={() => handleThumbMouseEnter("down")}
                onMouseLeave={handleThumbMouseLeave}
                className={`
                    ${buttonSize} rounded-md transition-all duration-150
                    ${feedbackType === "down" || hoveredThumb === "down"
                        ? "text-red-600 bg-red-50"
                        : "text-red-400 hover:text-red-500 hover:bg-red-50"}
                `}
                title="Dislike"
            >
                <ThumbsDown className={iconSize} />
            </button>

            {/* Copy Button */}
            {showCopy && (
                <button
                    onClick={handleCopy}
                    className={`
                        ${buttonSize} rounded-md transition-all duration-150
                        ${copied
                            ? "text-green-600 bg-green-50"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}
                    `}
                    title={copied ? "Copied!" : "Copy"}
                >
                    {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
                </button>
            )}

            {/* Feedback Popover - Rendered via Portal */}
            {mounted && showPopover && feedbackType && createPortal(
                <div
                    ref={popoverRef}
                    onMouseEnter={handlePopoverMouseEnter}
                    onMouseLeave={handlePopoverMouseLeave}
                    className="fixed w-80 bg-white rounded-lg shadow-xl border border-slate-200 pointer-events-auto"
                    style={{
                        left: position?.ready ? position.x : -9999,
                        top: position?.ready ? position.y : -9999,
                        zIndex: 99999,
                        opacity: position?.ready ? 1 : 0,
                        transition: position?.ready ? 'opacity 150ms ease-out' : 'none',
                    }}
                >
                    <div className="p-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-slate-600">
                                {showSuccess ? (
                                    <>&nbsp;</>
                                ) : (
                                    <>
                                        {feedbackType === "up"
                                            ? "What did you like?"
                                            : "What could be better?"}
                                    </>
                                )}
                            </span>
                            <button
                                onClick={handleClose}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content - Always same grid structure for consistent sizing */}
                        <div className="grid grid-cols-2 gap-2">
                            {showSuccess ? (
                                <div className="col-span-2 flex items-center justify-center gap-2 text-green-600 py-6">
                                    <Check className="w-5 h-5" />
                                    <span className="font-medium text-sm">Thanks for your feedback!</span>
                                </div>
                            ) : isOtherMode ? (
                                <div className="col-span-2 relative">
                                    <textarea
                                        ref={textareaRef}
                                        value={customText}
                                        onChange={(e) => setCustomText(e.target.value)}
                                        placeholder="Tell us more..."
                                        className="w-full p-2.5 pr-10 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                                        rows={4}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && customText.trim()) {
                                                e.preventDefault();
                                                handleCustomSubmit();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleCustomSubmit}
                                        disabled={!customText.trim() || isSubmitting}
                                        className="absolute bottom-2.5 right-2 p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? (
                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                                        ) : (
                                            <ArrowUp className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            ) : (
                                presets.map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => handlePresetClick(preset)}
                                        disabled={isSubmitting}
                                        className={`
                                            px-2.5 py-2 text-xs font-medium rounded-lg border transition-all duration-150
                                            ${selectedPreset === preset
                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}
                                            disabled:opacity-50
                                        `}
                                    >
                                        {preset}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

/**
 * Compact inline feedback for message responses
 * Shows thumbs + copy in a row below the message
 */
export function InlineResponseFeedback({
    nodeId,
    content,
    className = "",
}: {
    nodeId?: string;
    content: string;
    className?: string;
}) {
    return (
        <QuickFeedback
            context="response"
            componentName="inline_response"
            nodeId={nodeId}
            popoverPosition="top"
            size="sm"
            showCopy={true}
            copyContent={content}
            className={className}
        />
    );
}

/**
 * Periodic feedback reminder that appears after user spends time in chat
 * Slides up from bottom, auto-dismisses or can be manually closed
 */
export function PeriodicFeedbackPrompt({
    onDismiss,
}: {
    onDismiss: () => void;
}) {
    const [isExiting, setIsExiting] = useState(false);

    const handleDismiss = useCallback(() => {
        setIsExiting(true);
        setTimeout(onDismiss, 300); // Wait for animation to complete
    }, [onDismiss]);

    // Auto-dismiss after 15 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            handleDismiss();
        }, 15000);
        return () => clearTimeout(timer);
    }, [handleDismiss]);

    return (
        <div
            className={`
                fixed z-[9999] 
                bottom-24 md:bottom-8
                inset-x-0
                flex justify-center
                pointer-events-none
                ${isExiting ? 'animate-slide-down' : 'animate-slide-up'}
            `}
        >
            <div
                className={`
                    mx-4 md:mx-0
                    w-full md:w-auto md:max-w-md
                    bg-white rounded-xl shadow-xl border border-slate-200 
                    p-4
                    pointer-events-auto
                `}
            >
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-700 flex-1">
                        <span className="font-semibold">Hey!</span> Enjoying <span className="font-semibold">trevi</span>? Give us <span className="font-semibold">feedback</span>!
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <QuickFeedback
                            context="general"
                            componentName="periodic_prompt"
                            popoverPosition="top"
                            size="lg"
                        />
                        <button
                            onClick={handleDismiss}
                            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Disclaimer text shown at the bottom of the canvas
 */
export function TreviDisclaimer() {
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <p className="text-[10px] text-slate-400 whitespace-nowrap">
                Trevi is still in Alpha · It can make mistakes
            </p>
        </div>
    );
}
