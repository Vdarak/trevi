"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface TabDefinition {
    id: string;
    label: string;
    icon: LucideIcon;
}

interface ChatTabsProps {
    /** Array of tab definitions */
    tabs: TabDefinition[];
    /** Currently active tab id */
    activeTab: string;
    /** Callback when tab changes */
    onTabChange: (tabId: string) => void;
    /** Optional callback when clicking already-active tab (e.g., to refresh) */
    onRefetch?: (tabId: string) => void;
    /** Additional classes for the container */
    className?: string;
}

/**
 * ChatTabs - A reusable tab bar for chat interfaces.
 * 
 * Features:
 * - Icon + label for each tab (label only shown when active)
 * - Active indicator (blue underline)
 * - Optional refetch callback for refreshing content
 */
export function ChatTabs({
    tabs,
    activeTab,
    onTabChange,
    onRefetch,
    className,
}: ChatTabsProps) {
    return (
        <div className={cn("flex items-center", className)}>
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => {
                            if (isActive && onRefetch) {
                                onRefetch(tab.id);
                            }
                            onTabChange(tab.id);
                        }}
                        className={cn(
                            "relative flex items-center justify-center gap-2 px-3 py-3",
                            "text-sm font-medium transition-colors whitespace-nowrap",
                            isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <Icon className="w-5 h-5" />
                        {isActive && <span>{tab.label}</span>}
                        {isActive && (
                            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
