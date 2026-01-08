"use client";

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { X } from 'lucide-react';
import { ConversationPanelNodeData } from '../types';
import { renderSimpleMarkdown } from '../ui/markdown';

/**
 * Conversation panel with title bar, content, and chat input.
 * Appears attached to nodes in the graph.
 */
export function ConversationPanelNode({ data }: { data: ConversationPanelNodeData }) {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter and combine only assistant messages
    const aiContent = useMemo(() => {
        const assistantMessages = data.messages.filter(msg => msg.role === 'assistant');
        return assistantMessages.map(m => m.content).join('\n\n');
    }, [data.messages]);

    // Prevent wheel events from propagating to React Flow (which would zoom the canvas)
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (inputValue.trim() && !data.isStreaming && data.onSendMessage) {
            data.onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    if (!aiContent) return null;

    return (
        <div
            className="w-[400px] max-h-[500px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-scale-in flex flex-col"
            onWheelCapture={handleWheel}
        >
            {/* Target Handle on left - for edge connection */}
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-slate-400 !w-2.5 !h-2.5 !border-0 !rounded-full"
                style={{ left: -5 }}
            />

            {/* Header with title and close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                <h3 className="font-semibold text-slate-800 text-sm truncate pr-4 flex-1">
                    {data.label || 'Conversation'}
                </h3>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        data.onClose();
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Scrollable AI content - clean reading experience */}
            <div
                className="flex-1 overflow-y-auto overflow-x-hidden p-4 text-sm text-slate-700 leading-relaxed"
                style={{ maxHeight: '350px', scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
            >
                {renderSimpleMarkdown(aiContent, data.citations)}
            </div>

            {/* Chat input */}
            {data.onSendMessage && (
                <div className="border-t border-slate-100 p-3 bg-white flex-shrink-0">
                    {data.isStreaming && data.statusMessage && (
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                            <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                            <span>{data.statusMessage}</span>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            placeholder="Ask a follow-up..."
                            disabled={data.isStreaming}
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || data.isStreaming}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
