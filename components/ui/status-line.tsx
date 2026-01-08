import React from 'react';
import { TreviLogoAnimation, TreviLogoStatic } from '@/components/ui/trevi-logo';

interface StatusLineProps {
    status?: 'exploring' | 'idle' | 'error';
    title?: string;
    subtitle?: string;
    className?: string;
    warning?: string;
}

/**
 * Standardized Status Line Component
 * Shows Logo (32px) + Stacked Text (Title/Subtitle)
 * Used in Chat Sidebar, Node Panel, and Concept Nodes
 */
export function StatusLine({
    status = 'exploring',
    title = 'Exploring',
    subtitle,
    className = "",
    warning
}: StatusLineProps) {
    const isActive = status === 'exploring';

    // Warning state
    if (warning) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="flex-shrink-0">
                    <TreviLogoStatic size={45} />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-600 leading-none mb-0.5">
                        Warning
                    </span>
                    <span className="text-sm font-medium text-slate-700 leading-none truncate max-w-[200px]">
                        {warning}
                    </span>
                </div>
            </div>
        );
    }

    // Error state
    if (status === 'error') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="flex-shrink-0">
                    <TreviLogoStatic size={45} />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-600 leading-none mb-0.5">
                        Error
                    </span>
                    <span className="text-sm font-medium text-slate-700 leading-none truncate max-w-[200px]">
                        {subtitle}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="flex-shrink-0">
                {isActive ? (
                    <TreviLogoAnimation size={45} />
                ) : (
                    <TreviLogoStatic size={45} />
                )}
            </div>
            <div className="flex flex-col justify-center">
                <span className={`text-xs font-bold uppercase tracking-wider leading-none mb-0.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                    {title}
                </span>
                {subtitle && (
                    <span className={`text-sm font-medium leading-tight truncate max-w-[200px] ${isActive ? 'text-slate-700' : 'text-slate-500'}`}>
                        {subtitle}
                    </span>
                )}
            </div>
        </div>
    );
}
