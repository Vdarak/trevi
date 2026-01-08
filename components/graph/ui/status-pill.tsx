"use client";

import React from 'react';
import { TreviLogoAnimation, TreviLogoStatic } from '@/components/ui/trevi-logo';
import { StatusPillProps } from '../types';

/**
 * Global Status Pill Component
 * Shows current exploration status with expandable details for multiple nodes
 */
export function StatusPill({ globalStatus, isExpanded, onToggleExpand, warning }: StatusPillProps) {

    // Warning state - overrides everything else when present
    if (warning) {
        return (
            <div className="flex items-center px-2 py-2 rounded-full shadow-lg border backdrop-blur-sm bg-orange-50/90 border-orange-200 transition-all duration-300 ease-out animate-in fade-in zoom-in-95">
                {/* Logo Section - Responsive sizing */}
                <div className="flex-shrink-0">
                    <div className="md:hidden">
                        <TreviLogoStatic size={32} className="text-white" />
                    </div>
                    <div className="hidden md:block">
                        <TreviLogoStatic size={45} />
                    </div>
                </div>

                {/* Text Section - Stacked Layout */}
                <div className="flex flex-col ml-3 mr-2 max-w-[200px] md:max-w-md">
                    {/* Top Row: Status Title */}
                    <div className="flex items-center">
                        <span className="text-xs md:text-sm font-bold uppercase tracking-wider leading-none mb-0.5 text-orange-600">
                            Warning
                        </span>
                    </div>

                    {/* Bottom Row: Warning message */}
                    <span className="text-xs md:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis block max-w-[120px] md:max-w-[300px] leading-tight text-slate-700">
                        {warning}
                    </span>
                </div>
            </div>
        );
    }

    // Error state layout
    if (globalStatus.errors && globalStatus.errors.length > 0) {
        return (
            <div className="flex items-center px-2 py-2 rounded-full shadow-lg border backdrop-blur-sm bg-red-50/90 border-red-200 transition-all duration-300 ease-out">
                {/* Logo Section - Responsive sizing */}
                <div className="flex-shrink-0">
                    <div className="md:hidden">
                        <TreviLogoStatic size={32} />
                    </div>
                    <div className="hidden md:block">
                        <TreviLogoStatic size={45} />
                    </div>
                </div>

                {/* Text Section - Stacked Layout */}
                <div className="flex flex-col ml-3 mr-2 max-w-[200px] md:max-w-md">
                    {/* Top Row: Status Title */}
                    <div className="flex items-center">
                        <span className="text-xs md:text-sm font-bold uppercase tracking-wider leading-none mb-0.5 text-red-600">
                            Failure
                        </span>
                    </div>
                    {/* Bottom Row: Error Node Label */}
                    <span className="text-xs md:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis block max-w-[120px] md:max-w-[300px] leading-tight text-slate-700">
                        {globalStatus.errors[0].nodeLabel}
                    </span>
                </div>
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
                {/* Logo Section - Responsive sizing */}
                <div className="flex-shrink-0">
                    {globalStatus.isActive ? (
                        <>
                            <div className="md:hidden">
                                <TreviLogoAnimation size={32} className="text-white" />
                            </div>
                            <div className="hidden md:block">
                                <TreviLogoAnimation size={45} className="text-white" />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="md:hidden">
                                <TreviLogoStatic size={32} className="text-white" />
                            </div>
                            <div className="hidden md:block">
                                <TreviLogoStatic size={45} className="text-white" />
                            </div>
                        </>
                    )}
                </div>

                {/* Text Section - Stacked Layout */}
                <div className="flex flex-col ml-3 mr-2 max-w-[200px] md:max-w-md">
                    {/* Top Row: Status Title */}
                    <div className="flex items-center">
                        <span className={`text-xs md:text-sm font-bold uppercase tracking-wider leading-none mb-0.5 ${globalStatus.isActive ? 'text-blue-600' : 'text-blue-600'}`}>
                            {globalStatus.isActive ? 'Exploring' : 'Current'}
                        </span>

                        {/* Chevron aligned with title for better visual balance when stacked */}
                        {hasMultipleNodes && (
                            <svg
                                className={`w-3 h-3 ml-1.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} text-blue-400`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        )}
                    </div>

                    {/* Bottom Row: Node Label */}
                    <span className={`text-xs md:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis block max-w-[120px] md:max-w-[300px] leading-tight ${globalStatus.isActive ? 'text-slate-700' : ''}`}>
                        {globalStatus.isActive ? (
                            hasMultipleNodes
                                ? `${globalStatus.exploringNodeLabels!.length} nodes`
                                : globalStatus.exploringNodeLabels?.[0] || globalStatus.activeNodeLabel || 'Knowledge'
                        ) : (
                            globalStatus.activeNodeLabel || 'Ready'
                        )}
                    </span>
                </div>
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
