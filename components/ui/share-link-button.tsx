"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareShare, Loader2, Check, Copy, X } from 'lucide-react';
import { shareConversation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';

interface ShareLinkButtonProps {
    chatId?: string;
    nodeId?: string;
    /** Size variant to match adjacent buttons */
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * Share link button that opens a dialog to generate and copy the link.
 * This pattern (Dialog + Manual Copy) ensures reliability on Safari iOS.
 */
export function ShareLinkButton({
    chatId,
    nodeId,
    size = 'md',
    className,
}: ShareLinkButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const sizeStyles = {
        sm: 'p-1.5',
        md: 'p-1.5',
        lg: 'p-2',
    };

    const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

    const isDisabled = !chatId || !nodeId;

    return (
        <>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                disabled={isDisabled}
                title="Share conversation"
                className={cn(
                    "p-2 rounded-lg transition-colors text-blue-600 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 active:text-blue-600",
                    isOpen && "bg-blue-50 text-blue-600",
                    isDisabled && "opacity-50 cursor-not-allowed",
                    className
                )}
            >
                <MessageSquareShare className={iconSize} />
            </button>

            {isOpen && chatId && nodeId && (
                <SharePopover
                    chatId={chatId}
                    nodeId={nodeId}
                    triggerRef={buttonRef}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </>
    );
}

interface SharePopoverProps {
    chatId: string;
    nodeId: string;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}

function SharePopover({ chatId, nodeId, triggerRef, onClose }: SharePopoverProps) {
    const [url, setUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

    const popoverRef = useRef<HTMLDivElement>(null);

    // Fetch share link on mount
    useEffect(() => {
        let isMounted = true;

        async function fetchLink() {
            try {
                const { share_token } = await shareConversation(chatId, nodeId);
                if (isMounted) {
                    setUrl(`${window.location.origin}/share/${share_token}`);
                    setIsLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Failed to generate share link:', err);
                    setError('Failed to generate link');
                    setIsLoading(false);
                }
            }
        }

        fetchLink();

        return () => { isMounted = false; };
    }, [chatId, nodeId]);

    // Calculate position
    useLayoutEffect(() => {
        if (!triggerRef.current || !popoverRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const popoverRect = popoverRef.current.getBoundingClientRect();
        const padding = 16;
        const offset = 8;
        const vh = window.innerHeight;
        const vw = window.innerWidth;

        // Default: Bottom Center
        let x = triggerRect.left + (triggerRect.width / 2) - (popoverRect.width / 2);
        let y = triggerRect.bottom + offset;

        // Clamp Horizontal
        x = Math.max(padding, Math.min(x, vw - popoverRect.width - padding));

        // Clamp Vertical
        // If it goes off bottom, try top
        if (y + popoverRect.height > vh - padding) {
            // Try top
            const topY = triggerRect.top - popoverRect.height - offset;
            // If top fits better or bottom is totally blocked, use top
            if (topY >= padding) {
                y = topY;
            } else {
                // If neither fits perfectly, stick to bottom but clamped (might cover button, but better than offscreen)
                y = Math.min(y, vh - popoverRect.height - padding);
            }
        }

        setPosition({ x, y });
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, triggerRef]);

    const handleCopy = async () => {
        if (!url) return;
        const success = await copyToClipboard(url);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return createPortal(
        <div
            ref={popoverRef}
            style={{
                top: position ? position.y : 0,
                left: position ? position.x : 0,
                opacity: position ? 1 : 0,
                pointerEvents: position ? 'auto' : 'none',
            }}
            className="fixed z-[9999] w-[320px] bg-white rounded-xl shadow-xl border border-slate-200 p-4 transition-opacity duration-200"
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800">
                    Share this conversation
                </h3>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    {isLoading ? (
                        <div className="absolute inset-0 bg-slate-100 animate-pulse rounded-lg border border-slate-200" />
                    ) : null}

                    <input
                        type="text"
                        readOnly
                        value={error || url}
                        className={cn(
                            "w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none",
                            isLoading && "opacity-0", // Hide input data while loading (skeleton handles visual)
                            error && "text-red-500"
                        )}
                        onFocus={(e) => e.target.select()}
                    />
                </div>

                <button
                    onClick={handleCopy}
                    disabled={isLoading || !!error}
                    className={cn(
                        "p-2 rounded-lg border flex-shrink-0 transition-all duration-200",
                        copied
                            ? "bg-green-50 border-green-200 text-green-600"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300 hover:text-slate-700",
                        (isLoading || error) && "opacity-50 cursor-not-allowed"
                    )}
                    title="Copy link"
                >
                    {copied ? (
                        <Check className="w-4 h-4" />
                    ) : isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Copy className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Helper text */}
            {!error && (
                <p className="mt-2 text-[10px] text-slate-400">
                    {isLoading ? "Generating secure link..." : "Anyone with this link can view this conversation."}
                </p>
            )}
        </div>,
        document.body
    );
}
