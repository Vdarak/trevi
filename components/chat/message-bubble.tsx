"use client";

import React from 'react';
import type { Citation } from '@/lib/api';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
    citations?: Citation[];
}

export function MessageBubble({ role, content, isStreaming, citations }: MessageBubbleProps) {
    const isUser = role === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start w-full'} animate-fade-in`}>
            {isUser ? (
                <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-slate-800 text-white rounded-br-md">
                    <p className="text-sm whitespace-pre-wrap">{content}</p>
                </div>
            ) : (
                <div className="w-full">
                    {/* AI message - full width, no border, smaller text */}
                    <div className="text-xs leading-relaxed text-slate-700">
                        {renderMarkdownWithCitations(content, citations)}
                    </div>

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

// Helper function to find snippet for a citation
function findSnippetForCitation(citationIndex: number, citations?: Citation[]): string | null {
    if (!citations) return null;

    // Find the citation with matching index
    const citation = citations.find(c => c.index === citationIndex);
    if (!citation || !citation.occurrences || citation.occurrences.length === 0) {
        return null;
    }

    // Return the snippet from the first occurrence
    const snippet = citation.occurrences[0].snippet;
    return snippet && snippet !== "Source paragraph not found" ? snippet : null;
}

// Markdown renderer with citation bubble support
function renderMarkdownWithCitations(content: string, citations?: Citation[]): React.ReactNode {
    // FIRST: Protect markdown links by replacing them with placeholders
    const links: { text: string; url: string }[] = [];
    let processedText = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        links.push({ text, url });
        return `__LINK_${links.length - 1}__`;
    });

    // SECOND: Extract citations [index: title] - must have colon
    const extractedCitations: { index: string; title: string }[] = [];
    processedText = processedText.replace(/\[(\d+):\s*([^\]]+)\]/g, (match, index, title) => {
        extractedCitations.push({ index, title: title.trim() });
        return `__CITATION_${extractedCitations.length - 1}__`;
    });

    // THIRD: Handle standalone reference numbers [n] (in References section)
    processedText = processedText.replace(/\[(\d+)\]/g, '<sup class="text-blue-600 font-medium">[$1]</sup>');

    // Apply markdown transformations
    processedText = processedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gm, '<h4 class="font-semibold text-slate-900 mt-4 mb-2">$1</h4>')
        .replace(/^## (.*$)/gm, '<h3 class="font-semibold text-slate-900 mt-4 mb-2">$1</h3>')
        .replace(/^# (.*$)/gm, '<h2 class="font-bold text-slate-900 mt-4 mb-2">$1</h2>')
        .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-blue-400 pl-3 italic text-slate-600 my-2">$1</blockquote>')
        .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
        .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');

    // FOURTH: Restore links with proper HTML
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        processedText = processedText.replace(
            `__LINK_${i}__`,
            `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${link.text}</a>`
        );
    }

    // If no citations, use simple HTML rendering
    if (extractedCitations.length === 0) {
        return <span className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedText }} />;
    }

    // Split by citation placeholders and interleave with citation components
    const parts = processedText.split(/__CITATION_(\d+)__/);
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            if (parts[i]) {
                elements.push(
                    <span key={`text-${i}`} className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: parts[i] }} />
                );
            }
        } else {
            const citationArrayIndex = parseInt(parts[i], 10);
            const citation = extractedCitations[citationArrayIndex];
            if (citation) {
                const citationNumber = parseInt(citation.index, 10);
                const snippet = findSnippetForCitation(citationNumber, citations);
                const tooltipContent = snippet || citation.title;

                elements.push(
                    <span
                        key={`cite-${i}`}
                        className="inline-flex items-baseline relative group cursor-pointer"
                    >
                        <sup className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors leading-none">
                            {citation.index}
                        </sup>
                        {/* Tooltip - CSS only with group-hover */}
                        <span
                            className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 max-h-36 overflow-y-auto px-3 py-2 text-xs bg-slate-800 text-white rounded-lg shadow-xl whitespace-normal leading-relaxed"
                            style={{ zIndex: 99999 }}
                        >
                            {tooltipContent}
                        </span>
                    </span>
                );
            }
        }
    }

    return <>{elements}</>;
}
