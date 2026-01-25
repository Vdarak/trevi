"use client";

import React, { useState, useCallback } from 'react';
import { MessageSquareShare, Loader2, Check, X } from 'lucide-react';
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

type ShareState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Share link button that generates a shareable URL for the conversation.
 * Styling matches the QuickFeedback and close buttons in headers.
 */
export function ShareLinkButton({
    chatId,
    nodeId,
    size = 'md',
    className,
}: ShareLinkButtonProps) {
    const [state, setState] = useState<ShareState>('idle');

    const sizeStyles = {
        sm: 'p-1.5',
        md: 'p-1.5',
        lg: 'p-2',
    };

    const iconSize = 'w-5 h-5';

    const handleShare = useCallback(async () => {
        if (!chatId || !nodeId || state === 'loading') return;

        setState('loading');

        try {
            const { share_token } = await shareConversation(chatId, nodeId);
            const shareUrl = `${window.location.origin}/share/${share_token}`;

            // Copy to clipboard (with Safari iOS fallback)
            const success = await copyToClipboard(shareUrl);
            if (!success) {
                throw new Error('Failed to copy to clipboard');
            }

            setState('success');

            // Reset to idle after showing success
            setTimeout(() => setState('idle'), 2000);
        } catch (error) {
            console.error('Failed to share:', error);
            setState('error');
            setTimeout(() => setState('idle'), 2000);
        }
    }, [chatId, nodeId, state]);

    const isDisabled = !chatId || !nodeId;

    return (
        <button
            onClick={handleShare}
            disabled={isDisabled || state === 'loading'}
            title={
                state === 'success'
                    ? 'Link copied!'
                    : state === 'error'
                        ? 'Failed to copy'
                        : 'Copy share link'
            }
            className={cn(
                "rounded-lg transition-colors",
                sizeStyles[size],
                state === 'success'
                    ? "text-green-500 bg-green-50"
                    : state === 'error'
                        ? "text-red-500 bg-red-50"
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                isDisabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            {state === 'loading' ? (
                <Loader2 className={cn(iconSize, "animate-spin")} />
            ) : state === 'success' ? (
                <Check className={iconSize} />
            ) : state === 'error' ? (
                <X className={iconSize} />
            ) : (
                <MessageSquareShare className={iconSize} />
            )}
        </button>
    );
}
