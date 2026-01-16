"use client";

import React, { useState, useRef, useEffect } from 'react';
import type { Citation } from '@/lib/api';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { InlineResponseFeedback } from '@/components/feedback/quick-feedback';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
    citations?: Citation[];
    onEdit?: (newContent: string) => void;
    nodeId?: string;
}

export function MessageBubble({ role, content, isStreaming, citations, onEdit, nodeId }: MessageBubbleProps) {
    const isUser = role === 'user';
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Reset edit value when content changes
    useEffect(() => {
        setEditValue(content);
    }, [content]);

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
            // Adjust height
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editValue.trim() && editValue !== content && onEdit) {
            onEdit(editValue.trim());
            setIsEditing(false);
        } else {
            setIsEditing(false);
            setEditValue(content);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue(content);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <div className={`group flex ${isUser ? 'justify-end' : 'justify-start w-full'} animate-fade-in`}>
            {isUser ? (
                <div className="flex flex-col items-end max-w-[85%]">
                    {isEditing ? (
                        <div className="w-full min-w-[300px] bg-slate-800 rounded-2xl p-3 border border-slate-700">
                            <textarea
                                ref={textareaRef}
                                value={editValue}
                                onChange={(e) => {
                                    setEditValue(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-transparent text-white text-base resize-none focus:outline-none placeholder:text-slate-400"
                                rows={1}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={handleCancel}
                                    className="px-2 py-1 text-xs text-slate-300 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative group/bubble">
                            <div className="px-4 py-3 rounded-2xl bg-slate-800 text-white rounded-br-md">
                                <p className="text-sm whitespace-pre-wrap">{content}</p>
                            </div>

                            {onEdit && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 opacity-0 group-hover/bubble:opacity-100 transition-all"
                                    title="Edit query"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full">
                    {/* AI message - full width, no border, smaller text */}
                    <div className="text-xs leading-relaxed text-slate-700">
                        <MarkdownRenderer content={content} citations={citations} />
                    </div>

                    {/* Feedback + Copy buttons - Always visible */}
                    {!isStreaming && (
                        <div className="mt-2">
                            <InlineResponseFeedback nodeId={nodeId} content={content} />
                        </div>
                    )}

                    {/* Streaming indicator */}
                    {isStreaming && (
                        <div className="flex items-center gap-1 mt-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


