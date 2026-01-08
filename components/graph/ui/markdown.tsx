"use client";

import React from 'react';
import { Citation } from '@/lib/api';
import { CitationTooltipGraph, findSnippetForCitation } from './citation-tooltip';

/**
 * Simple markdown renderer for conversation messages with citation support.
 * Handles bold, italic, code, headers, lists, links, and citations.
 */
export function renderSimpleMarkdown(text: string, citationsData?: Citation[]): React.ReactNode {
    let processedText = text;

    // FIRST: Handle standalone reference numbers [n] BEFORE other processing
    // This prevents them from being captured by other patterns
    processedText = processedText.replace(/\[\s*(\d+)\s*\]/g, '__REF_$1__');

    // SECOND: Protect markdown links by replacing them with placeholders
    const links: { text: string; url: string }[] = [];
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        links.push({ text: linkText, url });
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
    processedText = processedText.replace(/__REF_(\d+)__/g, '<span class="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[9px] font-medium bg-blue-100 text-blue-700 rounded cursor-pointer" style="vertical-align: super; margin: 0 1px;">$1</span>');

    // Handle bold **text**
    processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Handle italic *text*
    processedText = processedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Handle inline code `code`
    processedText = processedText.replace(/`([^`]+)`/g, '<code class="bg-slate-200/50 px-1 rounded text-[10px]">$1</code>');
    // Handle headers ### text
    processedText = processedText.replace(/^###\s+(.+)$/gm, '<strong class="text-slate-700">$1</strong>');
    processedText = processedText.replace(/^##\s+(.+)$/gm, '<strong class="text-slate-800">$1</strong>');
    // Handle numbered lists and bullet points
    processedText = processedText.replace(/^\d+\.\s+/gm, '• ');
    processedText = processedText.replace(/^-\s+/gm, '• ');

    // FOURTH: Restore links with proper HTML
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        processedText = processedText.replace(
            `__LINK_${i}__`,
            `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline cursor-pointer">${link.text}</a>`
        );
    }

    // If no citations, use simple HTML rendering
    if (extractedCitations.length === 0) {
        return <span dangerouslySetInnerHTML={{ __html: processedText }} />;
    }

    // Split by citation placeholders and interleave with citation components
    const parts = processedText.split(/__CITATION_(\d+)__/);
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            // Regular text
            if (parts[i]) {
                elements.push(<span key={`text-${i}`} dangerouslySetInnerHTML={{ __html: parts[i] }} />);
            }
        } else {
            // Citation index
            const citationArrayIndex = parseInt(parts[i], 10);
            const citation = extractedCitations[citationArrayIndex];
            if (citation) {
                const citationNumber = parseInt(citation.index, 10);
                const snippet = findSnippetForCitation(citationNumber, citationsData);
                const tooltipContent = snippet || citation.title;
                // Find URL from citations data
                const citationData = citationsData?.find(c => c.index === citationNumber);
                const citationUrl = citationData?.url;

                elements.push(
                    <CitationTooltipGraph
                        key={`cite-${i}`}
                        index={citation.index}
                        content={tooltipContent}
                        url={citationUrl}
                    />
                );
            }
        }
    }

    return <>{elements}</>;
}
