"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ToolbarButtonProps } from '../types';

/**
 * Toolbar Button with Delayed Tooltip (md+ screens only)
 * Tooltip appears after 300ms hover on the right side
 */
export function ToolbarButton({ onClick, isActive = false, title, children, className = '' }: ToolbarButtonProps) {
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
            {/* Tooltip - hidden on small screens */}
            {showTooltip && (
                <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
                    <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-lg">
                        {title}
                        {/* Arrow */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                    </div>
                </div>
            )}
        </div>
    );
}
