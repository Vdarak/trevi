"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface NodeLabelBadgeProps {
    /** The label text to display */
    label: string;
    /** Whether this is the currently active/selected node */
    isActive?: boolean;
    /** Additional classes for customization */
    className?: string;
}

/**
 * NodeLabelBadge - A pill-shaped badge showing node labels in message lists.
 * 
 * Displays a colored dot and label text indicating which conversation node
 * the messages belong to.
 * 
 * Layout:
 *   Active:   ● Root Query     (blue dot, blue text)
 *   Inactive: ○ Follow-up      (gray dot, gray text)
 */
export function NodeLabelBadge({
    label,
    isActive = false,
    className,
}: NodeLabelBadgeProps) {
    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 mb-3 px-2.5 py-1",
            "rounded-full text-xs font-semibold",
            isActive ? "text-blue-700" : "text-slate-500",
            className
        )}>
            <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isActive ? "bg-blue-500" : "bg-slate-400"
            )} />
            {label}
        </div>
    );
}
