"use client";

import React, { useState, useRef, useLayoutEffect } from 'react';
import { TooltipProps } from '../types';

/**
 * Tooltip Component with Collision Detection
 * Automatically positions itself to stay within viewport bounds
 */
export function Tooltip({ content, position }: TooltipProps) {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState<{
        x: number;
        y: number;
        side: 'top' | 'bottom';
    }>({ x: position.x, y: position.y + 20, side: 'bottom' });

    useLayoutEffect(() => {
        if (!tooltipRef.current) return;

        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 8; // Minimum distance from viewport edges
        const offset = 12; // Distance from cursor

        let x = position.x;
        let y = position.y;
        let side: 'top' | 'bottom' = 'bottom';

        // Try placing below cursor first
        const bottomY = position.y + offset;
        const topY = position.y - tooltipRect.height - offset;

        // Check if it fits below
        if (bottomY + tooltipRect.height <= vh - padding) {
            y = bottomY;
            side = 'bottom';
        } else if (topY >= padding) {
            // Try above
            y = topY;
            side = 'top';
        } else {
            // Neither fits perfectly, use the one with more space
            const spaceBelow = vh - position.y - offset;
            const spaceAbove = position.y - offset;
            if (spaceBelow >= spaceAbove) {
                y = vh - tooltipRect.height - padding;
                side = 'bottom';
            } else {
                y = padding;
                side = 'top';
            }
        }

        // Center horizontally, but clamp to viewport
        x = position.x - tooltipRect.width / 2;
        x = Math.max(padding, Math.min(x, vw - tooltipRect.width - padding));

        setAdjustedPosition({ x, y, side });
    }, [position.x, position.y]);

    return (
        <div
            ref={tooltipRef}
            className="fixed z-[9999] max-w-xs px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg pointer-events-none"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
            }}
        >
            {content}
        </div>
    );
}
