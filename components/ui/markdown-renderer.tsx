"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import type { Citation } from '@/lib/api';
// Import centralized components from citation-tooltip.tsx
import { SmartCitationTooltip, findSnippetForCitation } from '../graph/ui/citation-tooltip';

interface DirectionNode {
    id: string;
    label: string;
}

interface MarkdownRendererProps {
    content: string;
    citations?: Citation[];
    directionNodes?: DirectionNode[];
    onDirectionClick?: (nodeId: string) => void;
    loadingNodeIds?: Set<string> | string[] | null;
}

/**
 * Shared Markdown Renderer Component
 * Renders markdown content with styled headers, lists, blockquotes, code blocks,
 * and intelligent citation tooltips.
 */
export function MarkdownRenderer({ content, citations, directionNodes, onDirectionClick, loadingNodeIds }: MarkdownRendererProps) {
    // Helper: Fuzzy matching for direction node labels
    const fuzzyMatchDirectionNode = (bulletText: string): DirectionNode | null => {
        if (!directionNodes || directionNodes.length === 0) return null;

        const normalize = (text: string) => text
            .toLowerCase()
            .trim()
            .replace(/[.,!?;:'"]/g, '') // Strip punctuation
            .replace(/\s+/g, ' '); // Normalize whitespace

        const normalizedBullet = normalize(bulletText);

        // 1. Try exact match
        for (const node of directionNodes) {
            if (normalize(node.label) === normalizedBullet) {
                return node;
            }
        }

        // 2. Try without common prefixes
        const prefixes = ['explore ', 'learn about ', 'understand ', 'discover ', 'investigate '];
        let strippedBullet = normalizedBullet;
        for (const prefix of prefixes) {
            if (strippedBullet.startsWith(prefix)) {
                strippedBullet = strippedBullet.slice(prefix.length);
                break;
            }
        }

        for (const node of directionNodes) {
            let strippedLabel = normalize(node.label);
            for (const prefix of prefixes) {
                if (strippedLabel.startsWith(prefix)) {
                    strippedLabel = strippedLabel.slice(prefix.length);
                    break;
                }
            }
            if (strippedLabel === strippedBullet) {
                return node;
            }
        }

        // 3. Try partial contains matching (label contains bullet or vice versa)
        for (const node of directionNodes) {
            const normalizedLabel = normalize(node.label);
            if (normalizedLabel.includes(normalizedBullet) || normalizedBullet.includes(normalizedLabel)) {
                // Only match if substantial overlap (>60% of shorter text)
                const shorter = Math.min(normalizedLabel.length, normalizedBullet.length);
                const longer = Math.max(normalizedLabel.length, normalizedBullet.length);
                if (shorter / longer > 0.6) {
                    return node;
                }
            }
        }

        return null;
    };

    let processedText = content;

    // SPECIAL: Detect and process "Areas to Explore" sections with clickable bullets
    if (directionNodes && directionNodes.length > 0 && onDirectionClick) {
        console.log('[MarkdownRenderer] Looking for Areas to Explore');
        console.log('[MarkdownRenderer] Direction nodes:', directionNodes);
        console.log('[MarkdownRenderer] Content length:', content.length);

        // Match "Areas to Explore" heading (handles bold markdown: **Areas to Explore:**)
        const areasRegex = /(?:^|\n)(#{1,3}\s*)?\*{0,2}Areas to Explore:?\*{0,2}\s*\n((?:[-*]\s+.+(?:\n|$))+)/gi;

        const matches = Array.from(content.matchAll(areasRegex));
        console.log('[MarkdownRenderer] Regex matches found:', matches.length);

        processedText = processedText.replace(areasRegex, (match, heading, bulletList) => {
            console.log('[MarkdownRenderer] Processing match!');
            console.log('[MarkdownRenderer] Bullet list:', bulletList);
            // Extract individual bullet points
            const bullets = bulletList.match(/[-*]\s+(.+)/g) || [];
            console.log('[MarkdownRenderer] Extracted', bullets.length, 'bullets');

            let replacedBullets = '';
            bullets.forEach((bullet: string, idx: number) => {
                // Extract bullet text and strip markdown
                let bulletText = bullet.replace(/^[-*]\s+/, '').trim();

                // Strip bold markers: **Text** -> Text
                bulletText = bulletText.replace(/^\*\*(.+?)\*\*/, '$1');

                // Extract title before colon if present: "Title: Description" -> "Title"
                const colonIndex = bulletText.indexOf(':');
                const titleOnly = colonIndex !== -1 ? bulletText.substring(0, colonIndex).trim() : bulletText;

                // For matching, use the title only
                const matchedNode = fuzzyMatchDirectionNode(titleOnly);

                console.log(`[MarkdownRenderer] Original: "${bullet.substring(0, 50)}" -> Title: "${titleOnly}" -> Matched:`, matchedNode?.label || 'NO MATCH');

                if (matchedNode) {
                    // Check if loading
                    const isLoading = loadingNodeIds instanceof Set
                        ? loadingNodeIds.has(matchedNode.id)
                        : Array.isArray(loadingNodeIds)
                            ? loadingNodeIds.includes(matchedNode.id)
                            : false;

                    // Create placeholder for clickable bullet
                    replacedBullets += `__CLICKABLE_BULLET_${idx}__${matchedNode.id}__${bulletText}__${isLoading}__\n`;
                } else {
                    // Keep as regular bullet
                    replacedBullets += `- ${bulletText}\n`;
                }
            });


            return `${heading || ''}**Areas to Explore:**\n${replacedBullets}`;
        });

        console.log('[MarkdownRenderer] After processing, has placeholders:', processedText.includes('__CLICKABLE_BULLET_'));
    }

    // FIRST: Handle standalone reference numbers [n] BEFORE other processing
    // This prevents them from being captured by other patterns
    processedText = processedText.replace(/\[\s*(\d+)\s*\]/g, '__REF_$1__');

    // SECOND: Protect markdown links by replacing them with placeholders
    const links: { text: string; url: string }[] = [];
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        links.push({ text, url });
        return `__LINK_${links.length - 1}__`;
    });

    // THIRD: Extract citations [index: title] or [[index: title]] - must have colon
    // Also remove any parenthesized URL immediately following the citation
    const extractedCitations: { index: string; title: string }[] = [];
    // Match both single [1: Title] and double [[1: Title]] bracket citations
    processedText = processedText.replace(/\[?\[(\d+):\s*([^\]]+)\]\]?(?:\s*\([^)]+\))?/g, (match, index, title) => {
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
        .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc marker:text-slate-700" style="line-height: 1.5;">$1</li>')
        .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');

    // FOURTH: Restore links with proper HTML
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        processedText = processedText.replace(
            `__LINK_${i}__`,
            `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${link.text}</a>`
        );
    }

    // If no citations and no clickable bullets, use simple HTML rendering
    const hasClickableBullets = processedText.includes('__CLICKABLE_BULLET_');

    console.log('[MarkdownRenderer] Rendering - Has clickable bullets:', hasClickableBullets);

    if (extractedCitations.length === 0 && !hasClickableBullets) {
        return <span className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processedText }} />;
    }

    // Split by both citation AND clickable bullet placeholders
    const combinedPattern = /(__CITATION_\d+__|__CLICKABLE_BULLET_\d+__[^_]+__.+?__(?:true|false)__)/g;
    const parts = processedText.split(combinedPattern);
    const elements: React.ReactNode[] = [];

    console.log('[MarkdownRenderer] Split into', parts.length, 'parts');

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Handle citation placeholders
        if (part.startsWith('__CITATION_')) {
            const citationMatch = part.match(/__CITATION_(\d+)__/);
            if (citationMatch) {
                const citationArrayIndex = parseInt(citationMatch[1], 10);
                const citation = extractedCitations[citationArrayIndex];
                if (citation) {
                    const citationNumber = parseInt(citation.index, 10);
                    const snippet = findSnippetForCitation(citationNumber, citations);
                    const tooltipContent = snippet || citation.title;
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
        // Handle clickable bullet placeholders
        else if (part.startsWith('__CLICKABLE_BULLET_')) {
            console.log('[MarkdownRenderer] Found clickable bullet placeholder:', part);
            const bulletMatch = part.match(/__CLICKABLE_BULLET_(\d+)__([^_]+)__(.+?)__(true|false)__/);
            if (bulletMatch) {
                console.log('[MarkdownRenderer] Bullet match successful:', bulletMatch);
                const [, idx, nodeId, bulletText, isLoadingStr] = bulletMatch;
                const isLoading = isLoadingStr === 'true';

                elements.push(
                    <li
                        key={`bullet-${idx}`}
                        className="ml-4 list-disc marker:text-slate-700"
                    >
                        <button
                            onClick={() => onDirectionClick!(nodeId)}
                            disabled={isLoading}
                            className={`
                                text-left w-full min-h-[44px] -ml-1 pl-1
                                transition-colors rounded
                                ${isLoading
                                    ? 'text-slate-400 cursor-wait'
                                    : 'text-blue-600 hover:text-blue-700 active:text-blue-800 cursor-pointer hover:underline active:bg-blue-50'
                                }
                            `}
                            style={{ 
                                display: 'block',
                                paddingTop: '0.125rem',
                                paddingBottom: '0.125rem',
                                lineHeight: '1.5'
                            }}
                        >
                            {isLoading && (
                                <span className="inline-block mr-2 align-middle">
                                    <svg className="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </span>
                            )}
                            {bulletText}
                        </button>
                    </li>
                );
            }
        }
        // Regular text content
        else if (part) {
            elements.push(
                <span key={`text-${i}`} className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: part }} />
            );
        }
    }

    return <>{elements}</>;
}

/**
 * Simple markdown renderer function for conversation messages.
 * Similar to MarkdownRenderer but returns ReactNode directly.
 * Used in graph nodes where function-based rendering is preferred.
 */
export function renderSimpleMarkdown(text: string, citationsData?: Citation[]): React.ReactNode {
    let processedText = text;

    // FIRST: Handle standalone reference numbers [n] BEFORE other processing
    processedText = processedText.replace(/\[\s*(\d+)\s*\]/g, '__REF_$1__');

    // SECOND: Protect markdown links by replacing them with placeholders
    const links: { text: string; url: string }[] = [];
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        links.push({ text: linkText, url });
        return `__LINK_${links.length - 1}__`;
    });

    // THIRD: Extract citations [index: title] or [[index: title]] - must have colon
    const extractedCitations: { index: string; title: string }[] = [];
    // Match both single [1: Title] and double [[1: Title]] bracket citations
    processedText = processedText.replace(/\[?\[(\d+):\s*([^\]]+)\]\]?(?:\s*\([^)]+\))?/g, (match, index, title) => {
        extractedCitations.push({ index, title: title.trim() });
        return `__CITATION_${extractedCitations.length - 1}__`;
    });

    // Strip any remaining standalone parenthesized URLs
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

    // Restore links with proper HTML
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
            if (parts[i]) {
                elements.push(<span key={`text-${i}`} dangerouslySetInnerHTML={{ __html: parts[i] }} />);
            }
        } else {
            const citationArrayIndex = parseInt(parts[i], 10);
            const citation = extractedCitations[citationArrayIndex];
            if (citation) {
                const citationNumber = parseInt(citation.index, 10);
                const snippet = findSnippetForCitation(citationNumber, citationsData);
                const tooltipContent = snippet || citation.title;
                const citationData = citationsData?.find(c => c.index === citationNumber);
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
