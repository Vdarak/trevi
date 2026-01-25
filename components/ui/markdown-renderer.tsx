"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import type { Citation } from '@/lib/api';
// Import centralized components from citation-tooltip.tsx
import { SmartCitationTooltip, findSnippetForCitation } from '../graph/ui/citation-tooltip';

interface MarkdownRendererProps {
    content: string;
    citations?: Citation[];
}

/**
 * Shared Markdown Renderer Component
 * Renders markdown content with styled headers, lists, blockquotes, code blocks,
 * and intelligent citation tooltips.
 */
export function MarkdownRenderer({ content, citations }: MarkdownRendererProps) {
    let processedText = content;

    // FIRST: Handle standalone reference numbers [n] BEFORE other processing
    // This prevents them from being captured by other patterns
    processedText = processedText.replace(/\[\s*(\d+)\s*\]/g, '__REF_$1__');

    // SECOND: Protect markdown links by replacing them with placeholders
    const links: { text: string; url: string }[] = [];
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        links.push({ text, url });
        return `__LINK_${links.length - 1}__`;
    });

    // THIRD: Extract citations [index: title] - must have colon
    // Also remove any parenthesized URL immediately following the citation
    const extractedCitations: { index: string; title: string }[] = [];
    processedText = processedText.replace(/\[(\d+):\s*([^\]]+)\](?:\s*\([^)]+\))?/g, (match, index, title) => {
        extractedCitations.push({ index, title: title.trim() });
        return `__CITATION_${extractedCitations.length - 1}__`;
    });

    // Also strip any remaining standalone parenthesized URLs (http/https links in parentheses)
    processedText = processedText.replace(/\s*\(https?:\/\/[^)]+\)/g, '');

    // FOURTH: Restore standalone reference numbers as styled bubbles
    processedText = processedText.replace(/__REF_(\d+)__/g, '<span class="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-medium bg-blue-100 text-blue-700 rounded cursor-pointer" style="vertical-align: super; margin: 0 1px;">$1</span>');

    // Apply markdown transformations with Updated Header Styles
    processedText = processedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // UPDATED: Bigger and Bolder Headers
        .replace(/^### (.*$)/gm, '<h4 class="text-base font-bold text-slate-900 mt-4 mb-2">$1</h4>')
        .replace(/^## (.*$)/gm, '<h3 class="text-lg font-bold text-slate-900 mt-5 mb-3">$1</h3>')
        .replace(/^# (.*$)/gm, '<h2 class="text-xl font-bold text-slate-900 mt-6 mb-4">$1</h2>')
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
                // Find URL from citations data
                const citationData = citations?.find(c => c.index === citationNumber);
                const citationUrl = citationData?.url;

                elements.push(
                    <SmartCitationTooltip
                        key={`cite-${i}`}
                        index={citation.index}
                        title={citation.title}
                        content={tooltipContent}
                        url={citationUrl}
                    />
                );
            }
        }
    }

    return <>{elements}</>;
}
