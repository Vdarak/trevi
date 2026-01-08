"use client";

import React from 'react';
import { TreviLogoAnimation, TreviLogoStatic } from '@/components/ui/trevi-logo';
import { StatusPillProps } from '../types';

/**
 * Global Status Pill Component
 * Shows current exploration status with expandable details for multiple nodes
 */
export function StatusPill({ globalStatus, isExpanded, onToggleExpand }: StatusPillProps) {
    // Error state
    if (globalStatus.errors && globalStatus.errors.length > 0) {
        return (
            <div className="flex items-center px-3 py-2 rounded-full shadow-lg border backdrop-blur-sm bg-red-50/90 border-red-200 text-red-700 transition-all duration-300 ease-out">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-medium">
                    Failed: {globalStatus.errors[0].nodeLabel}
                </span>
            </div>
        );
    }

    const hasMultipleNodes = globalStatus.exploringNodeLabels && globalStatus.exploringNodeLabels.length > 1;

    return (
        <div className="flex flex-col items-center">
            {/* Main Pill - clickable when multiple nodes */}
            <div
                onClick={() => {
                    if (hasMultipleNodes) {
                        onToggleExpand();
                    }
                }}
                className={`
          flex items-center px-2 py-2 rounded-full shadow-lg border backdrop-blur-sm
          transition-all duration-300 ease-out overflow-hidden
          ${globalStatus.isActive
                        ? 'bg-blue-50/90 border-blue-200 text-blue-700'
                        : 'bg-white/90 border-slate-200 text-slate-600'}
          ${hasMultipleNodes ? 'cursor-pointer hover:shadow-xl' : ''}
        `}
            >
                {globalStatus.isActive ? (
                    <TreviLogoAnimation size={32} />
                ) : (
                    <TreviLogoStatic size={32} />
                )}
                {globalStatus.isActive ? (
                    <div className="flex items-center gap-1.5 px-2 max-w-[200px] md:max-w-md">
                        <span className="text-xs md:text-sm font-medium whitespace-nowrap">Exploring</span>
                        <span className="text-slate-400">—</span>
                        <span className="text-xs md:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis block max-w-[120px] md:max-w-[300px]">
                            {hasMultipleNodes
                                ? `${globalStatus.exploringNodeLabels!.length} nodes`
                                : globalStatus.exploringNodeLabels?.[0] || globalStatus.activeNodeLabel || 'Knowledge'}
                        </span>
                        {/* Expand/collapse chevron for multiple nodes */}
                        {hasMultipleNodes && (
                            <svg
                                className={`w-4 h-4 ml-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} flex-shrink-0`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-2 max-w-[200px] md:max-w-md">
                        <span className="text-xs md:text-sm text-blue-600 font-bold whitespace-nowrap">Current</span>
                        <span className="text-slate-400">—</span>
                        <span className="text-xs md:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis block max-w-[120px] md:max-w-[300px]">
                            {globalStatus.activeNodeLabel || 'Ready'}
                        </span>
                    </div>
                )}
            </div>

            {/* Expanded dropdown showing all exploring nodes */}
            {isExpanded && hasMultipleNodes && (
                <div className="mt-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-blue-200 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-slate-100 bg-blue-50/50">
                        <span className="text-xs font-medium text-blue-600">Currently Exploring</span>
                    </div>
                    <div className="py-1 max-h-48 overflow-y-auto">
                        {globalStatus.exploringNodeLabels!.map((label, index) => (
                            <div
                                key={globalStatus.exploringNodeIds?.[index] || index}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50"
                            >
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-sm text-slate-700">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
