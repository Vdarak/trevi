"use client";

import React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { StatusLine } from '@/components/ui/status-line';
import { cn } from '@/lib/utils';

interface ChatInputProps {
    /** Callback when user submits a message */
    onSendMessage: (message: string) => void;
    /** Whether a message is currently being processed/streamed */
    isStreaming?: boolean;
    /** Status message to display during streaming */
    statusMessage?: string;
    /** Placeholder text for the input */
    placeholder?: string;
    /** Size variant for styling */
    size?: 'sm' | 'md' | 'lg';
    /** Additional classes for the container */
    className?: string;
    /** Ref to the input element for focus management */
    inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * ChatInput - A reusable chat input with streaming status.
 * 
 * Features:
 * - Input field with submit button
 * - Status line during streaming
 * - Disabled state during streaming
 * - Size variants for different contexts
 */
export function ChatInput({
    onSendMessage,
    isStreaming = false,
    statusMessage = '',
    placeholder = 'Ask a follow-up...',
    size = 'md',
    className,
    inputRef,
}: ChatInputProps) {
    const [inputValue, setInputValue] = React.useState('');
    const localInputRef = React.useRef<HTMLInputElement>(null);
    const ref = inputRef || localInputRef;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isStreaming) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    // Size-based styles
    const sizeStyles = {
        sm: {
            container: 'p-2',
            input: 'px-3 py-2 text-sm rounded-lg',
            button: 'p-2 rounded-lg',
            icon: 'w-4 h-4',
            gap: 'gap-2',
        },
        md: {
            container: 'p-3',
            input: 'px-4 py-3 text-base rounded-xl',
            button: 'p-3 rounded-xl',
            icon: 'w-5 h-5',
            gap: 'gap-2',
        },
        lg: {
            container: 'p-4',
            input: 'px-4 py-3.5 text-base rounded-xl',
            button: 'p-3.5 rounded-xl',
            icon: 'w-5 h-5',
            gap: 'gap-3',
        },
    };

    const styles = sizeStyles[size];

    return (
        <div className={cn(
            "flex-shrink-0 bg-white border-t border-slate-200",
            "pb-[env(safe-area-inset-bottom)]",
            styles.container,
            className
        )}>
            {/* Status Line during streaming */}
            {isStreaming && statusMessage && (
                <div className="mb-2 animate-fade-in">
                    <StatusLine
                        status="exploring"
                        title="Exploring"
                        subtitle={statusMessage || "Processing..."}
                    />
                </div>
            )}

            <form onSubmit={handleSubmit} className={cn("flex items-center", styles.gap)}>
                <input
                    ref={ref}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={placeholder}
                    disabled={isStreaming}
                    className={cn(
                        "flex-1 border border-slate-200",
                        "bg-slate-50 text-slate-800",
                        "placeholder:text-slate-400",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "transition-all",
                        styles.input
                    )}
                />
                <button
                    type="submit"
                    disabled={!inputValue.trim() || isStreaming}
                    className={cn(
                        "bg-slate-900 text-white",
                        "hover:bg-slate-800 active:scale-95",
                        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
                        "transition-all",
                        styles.button
                    )}
                >
                    {isStreaming ? (
                        <Loader2 className={cn(styles.icon, "animate-spin")} />
                    ) : (
                        <Send className={styles.icon} />
                    )}
                </button>
            </form>
        </div>
    );
}
