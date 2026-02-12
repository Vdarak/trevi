"use client";

import React, { useState, useRef, useLayoutEffect } from 'react';
import { ScrollText } from 'lucide-react';
import { TooltipProps } from '../types';
import { renderSimpleMarkdown } from '@/components/ui/markdown-renderer';

/**
 * Tooltip Component
 * - 'gist' variant: White card with title + ScrollText icon + markdown bullet points (conversation nodes)
 * - 'simple' variant: White card with just the summary text (direction/explore nodes)
 * Non-clickable, non-scrollable. Positions itself within viewport bounds.
 */
export function Tooltip({ title, bullets, variant, position }: TooltipProps) {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState<{
        x: number;
        y: number;
    }>({ x: position.x, y: position.y + 20 });

    useLayoutEffect(() => {
        if (!tooltipRef.current) return;

        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 8;
        const offset = 12;

        let x = position.x;
        let y = position.y;

        // Try placing below cursor first
        const bottomY = position.y + offset;
        const topY = position.y - tooltipRect.height - offset;

        if (bottomY + tooltipRect.height <= vh - padding) {
            y = bottomY;
        } else if (topY >= padding) {
            y = topY;
        } else {
            const spaceBelow = vh - position.y - offset;
            const spaceAbove = position.y - offset;
            if (spaceBelow >= spaceAbove) {
                y = vh - tooltipRect.height - padding;
            } else {
                y = padding;
            }
        }

        // Center horizontally, but clamp to viewport
        x = position.x - tooltipRect.width / 2;
        x = Math.max(padding, Math.min(x, vw - tooltipRect.width - padding));

        setAdjustedPosition({ x, y });
    }, [position.x, position.y]);

    // Simple variant: just summary text in a white box
    if (variant === 'simple') {
        return (
            <div
                ref={tooltipRef}
                className="fixed z-[9999] max-w-xs rounded-lg bg-white text-slate-900 shadow-lg border border-slate-200 px-3 py-2 pointer-events-none"
                style={{
                    left: adjustedPosition.x,
                    top: adjustedPosition.y,
                }}
            >
                <p className="text-[11.5px] leading-relaxed text-slate-700">
                    {title}
                </p>
            </div>
        );
    }

    // Gist variant: title + ScrollText icon + markdown bullet points
    return (
        <div
            ref={tooltipRef}
            className="fixed z-[9999] max-w-sm rounded-xl bg-white text-slate-900 shadow-2xl border border-slate-200 overflow-hidden pointer-events-none"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
            }}
        >
            {/* Header: Title + ScrollText icon */}
            <div className="flex items-start justify-between gap-3 px-3.5 pt-3 pb-2">
                <h3 className="text-[12.5px] font-semibold leading-snug text-slate-900 flex-1 line-clamp-2">
                    {title}
                </h3>
                <ScrollText className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
            </div>

            {/* Bullets with markdown rendering */}
            {bullets && bullets.length > 0 && (
                <>
                    <div className="mx-3.5 border-t border-slate-100" />

                    <ul className="px-3.5 pt-2 pb-3 space-y-1.5">
                        {bullets.map((bullet, i) => (
                            <li
                                key={i}
                                className="flex items-start gap-2 text-[11px] leading-[1.55] text-slate-900"
                            >
                                <span className="mt-[5px] w-1 h-1 rounded-full bg-slate-900 flex-shrink-0" />
                                <span className="tooltip-markdown">
                                    {renderSimpleMarkdown(bullet)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
