"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ToolbarButtonProps } from '../types';

/**
 * Toolbar Button with Delayed Tooltip (md+ screens only)
 * Tooltip appears after 300ms hover on the specified side (default: right)
 */
export function ToolbarButton({ onClick, isActive = false, title, children, className = '', tooltipPosition = 'right' }: ToolbarButtonProps & { tooltipPosition?: 'left' | 'right' }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setShowTooltip(true);
        }, 300); // 0.3s delay
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setShowTooltip(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <div className="relative">
            <button
                onClick={onClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={`p-2 rounded ${isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'} ${className}`}
            >
                {children}
            </button>
            {showTooltip && (
                <div className={`hidden md:block absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none ${tooltipPosition === 'left' ? 'right-full mr-2' : 'left-full ml-2'
                    }`}>
                    <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-lg">
                        {title}
                        {/* Arrow */}
                        <div className={`absolute top-1/2 -translate-y-1/2 border-4 border-transparent ${tooltipPosition === 'left' ? 'left-full border-l-slate-800' : 'right-full border-r-slate-800'
                            }`} />
                    </div>
                </div>
            )}
        </div>
    );
}
