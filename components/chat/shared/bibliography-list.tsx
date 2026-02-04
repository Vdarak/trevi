"use client";

import React from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Citation, BibliographyResponse } from '@/lib/api';

interface BibliographyListProps {
    /** Bibliography data - either from API response or share response format */
    bibliography: BibliographyResponse | Record<string, string[]> | null;
    /** All citations from conversation nodes (for title enrichment) */
    citations?: Citation[];
    /** Whether bibliography is currently loading */
    isLoading?: boolean;
    /** Custom empty state message */
    emptyMessage?: string;
    /** Additional classes */
    className?: string;
}

/**
 * BibliographyList - Renders a list of bibliography entries with usage labels.
 * 
 * Features:
 * - Numbered index badges
 * - Title + URL display with hover states
 * - Usage labels (tags from API)
 * - Loading and empty states
 */
export function BibliographyList({
    bibliography,
    citations = [],
    isLoading = false,
    emptyMessage = 'No sources found',
    className,
}: BibliographyListProps) {
    // Normalize bibliography data to Record<string, string[]> format
    let referenceUsage: Record<string, string[]> = {};
    if (bibliography) {
        if ('reference_usage' in bibliography && typeof bibliography.reference_usage === 'object' && !Array.isArray(bibliography.reference_usage)) {
            referenceUsage = bibliography.reference_usage as Record<string, string[]>;
        } else if (typeof bibliography === 'object' && !Array.isArray(bibliography)) {
            referenceUsage = bibliography as Record<string, string[]>;
        }
    }

    // Build URL -> Citation map for title enrichment
    const urlToCitation = React.useMemo(() => {
        const map = new Map<string, Citation>();
        citations.forEach(c => {
            if (c.url) map.set(c.url, c);
        });
        return map;
    }, [citations]);

    if (isLoading) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-20 text-slate-400", className)}>
                <Loader2 className="w-8 h-8 mb-3 animate-spin text-blue-500" />
                <p className="text-sm font-medium">Loading bibliography...</p>
            </div>
        );
    }

    const entries = Object.entries(referenceUsage);

    if (entries.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-20 text-slate-400", className)}>
                <BookOpen className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">{emptyMessage}</p>
                <p className="text-xs mt-1 opacity-70">Bibliography is empty</p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-6", className)}>
            {entries.map(([url, labels], idx) => {
                const citation = urlToCitation.get(url);
                const displayUrl = url;

                // Get title from citation or parse from URL
                let displayTitle = citation?.title;
                if (!displayTitle) {
                    try {
                        const urlObj = new URL(url);
                        displayTitle = urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
                    } catch {
                        displayTitle = url;
                    }
                }

                // Filter out "General" labels
                const validLabels = labels.filter((label: string) => label !== "General");
                const displayIndex = idx + 1;

                return (
                    <div key={url} className="group relative">
                        <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100/60 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200">
                            {/* Index Badge */}
                            <div className="flex-shrink-0">
                                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-mono font-medium text-slate-500 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                                    {displayIndex}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-2">
                                {/* Title & Link */}
                                <div>
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/link block"
                                    >
                                        <h4 className="text-sm font-semibold text-slate-800 leading-snug group-hover/link:text-blue-600 transition-colors line-clamp-2">
                                            {displayTitle}
                                        </h4>
                                        <div className="text-xs text-slate-400 font-mono mt-1 w-full truncate opacity-70 group-hover/link:opacity-100 transition-all">
                                            {displayUrl}
                                        </div>
                                    </a>
                                </div>

                                {/* Usage Labels */}
                                {validLabels.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {validLabels.map((label: string, labelIdx: number) => (
                                            <span
                                                key={`${url}-${labelIdx}`}
                                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-semibold bg-white border border-slate-200 text-slate-500"
                                            >
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
