"use client";

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import type { MessagePayload } from '@/lib/api';

interface NodeConversationPanelProps {
    isOpen: boolean;
    messages: MessagePayload[];
    nodeLabel?: string;
    onClose: () => void;
}

/**
 * A floating glass panel that displays a node's conversation.
 * Positioned by parent container - renders above the canvas.
 */
export function NodeConversationPanel({
    isOpen,
    messages,
    nodeLabel,
    onClose,
}: NodeConversationPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    if (!isOpen || messages.length === 0) return null;

    return (
        <div
            ref={panelRef}
            className={`
        w-[360px] max-h-[50vh]
        bg-white/85 backdrop-blur-xl
        border border-white/50 rounded-2xl
        shadow-2xl shadow-slate-900/10
        flex flex-col
        animate-fade-in
      `}
            style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.88) 100%)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/50 flex-shrink-0">
                <h3 className="font-medium text-slate-800 text-sm truncate max-w-[260px]">
                    {nodeLabel || 'Conversation'}
                </h3>
                <button
                    onClick={onClose}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg, index) => (
                    <MessageBubble
                        key={index}
                        role={msg.role}
                        content={msg.content}
                    />
                ))}
            </div>
        </div>
    );
}
