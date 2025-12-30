"use client";

import React from 'react';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
    const isUser = role === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div
                className={`
          max-w-[85%] px-4 py-3 rounded-2xl
          ${isUser
                        ? 'bg-slate-800 text-white rounded-br-md'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                    }
        `}
            >
                {isUser ? (
                    <p className="text-sm whitespace-pre-wrap">{content}</p>
                ) : (
                    <div className="prose prose-sm prose-slate max-w-none">
                        {/* Simple markdown-like rendering for assistant messages */}
                        <div
                            className="text-sm leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                                __html: formatMarkdown(content)
                            }}
                        />
                    </div>
                )}

                {/* Streaming indicator */}
                {isStreaming && (
                    <div className="flex items-center gap-1 mt-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                )}
            </div>
        </div>
    );
}

// Simple markdown formatter
function formatMarkdown(content: string): string {
    return content
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Headers
        .replace(/^### (.*$)/gm, '<h4 class="font-semibold text-slate-900 mt-4 mb-2">$1</h4>')
        .replace(/^## (.*$)/gm, '<h3 class="font-semibold text-slate-900 mt-4 mb-2">$1</h3>')
        .replace(/^# (.*$)/gm, '<h2 class="font-bold text-slate-900 mt-4 mb-2">$1</h2>')
        // Links
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-blue-600 hover:underline">$1</a>')
        // Blockquotes
        .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-blue-400 pl-3 italic text-slate-600 my-2">$1</blockquote>')
        // List items
        .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
        // Code inline
        .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
}
