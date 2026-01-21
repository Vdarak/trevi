"use client";

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Compass } from 'lucide-react';
import { ConceptNodeData } from '../types';
import { TreviLogoAnimation } from '@/components/ui/trevi-logo';

// ============================================================================
// Chevron Icons
// ============================================================================

export function ChevronRightIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6L15 12L9 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ChevronLeftIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
            <path d="M15 6L9 12L15 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ChevronDownIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
            <path d="M6 9L12 15L18 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ChevronUpIcon({ className = "" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
            <path d="M18 15L12 9L6 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ExploreIcon({ className = "" }: { className?: string }) {
    return <Compass className={`w-full h-full ${className}`} strokeWidth={2} />;
}

// ============================================================================
// ConceptNode Component
// ============================================================================

interface ConceptNodeProps {
    data: ConceptNodeData;
    targetPosition?: Position;
    sourcePosition?: Position;
}

export function ConceptNode({ data, targetPosition, sourcePosition }: ConceptNodeProps) {
    const isClickableDirection = data.isDirection && !data.hasChildren;
    const showCollapsedDots = data.isCollapsed && data.hasChildren && (data.childCount ?? 0) > 0;
    const direction = data.direction || 'TB';
    const isHorizontal = direction === 'LR';

    // Hierarchy-based styling
    const isParentNode = data.hasChildren;

    // Size scaling based on hierarchy
    const sizeClass = data.isRoot
        ? 'px-6 py-4' // Root: largest
        : isParentNode
            ? 'px-5 py-3' // Parents: normal
            : 'px-4 py-2.5'; // Leaves: compact

    // Border thickness based on hierarchy
    const borderClass = data.isRoot
        ? 'border-[3px]'
        : isParentNode
            ? 'border-2'
            : 'border';

    // Border radius - pill for root, rounded for others
    const radiusClass = data.isRoot
        ? 'rounded-full'
        : isParentNode
            ? 'rounded-xl'
            : 'rounded-lg';

    // Shadow scaling
    const shadowClass = data.isRoot
        ? 'shadow-lg'
        : isParentNode
            ? 'shadow-md'
            : 'shadow-sm';

    // Text styling
    const textClass = data.isRoot
        ? 'font-bold text-base'
        : isParentNode
            ? 'font-semibold text-sm'
            : 'font-medium text-sm';

    // Determine which chevron icons to use based on direction and collapse state
    const getExpandIcon = () => {
        if (isHorizontal) return <ChevronRightIcon />;
        return <ChevronDownIcon />;
    };

    const getCollapseIcon = () => {
        if (isHorizontal) return <ChevronLeftIcon />;
        return <ChevronUpIcon />;
    };

    return (
        <div className={`relative ${isHorizontal ? 'flex items-center' : 'flex flex-col items-center'}`}>


            {/* Main node box */}
            <div
                className={`
          relative z-10 ${sizeClass} ${radiusClass} ${shadowClass} transition-all duration-200 flex items-center gap-3 whitespace-nowrap
          ${data.isRoot
                        ? data.isInActivePath || data.isActiveNode
                            ? "bg-slate-900 text-white border-[3px] border-blue-500"
                            : "bg-slate-900 text-white border-[3px] border-slate-900"
                        : data.isLoading
                            // Use transparent border to maintain layout size, but hide visual border (replaced by crawling ants)
                            ? "bg-blue-50 border-[3px] border-transparent"
                            : isClickableDirection
                                ? data.isInActivePath || data.isActiveNode
                                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-[3px] border-blue-500 cursor-pointer"
                                    : "bg-gradient-to-r from-blue-50 to-indigo-50 border-[3px] border-blue-200 hover:border-blue-400 cursor-pointer hover:shadow-md"
                                : data.isInActivePath || data.isActiveNode
                                    ? "bg-blue-50 border-[3px] border-blue-500"
                                    : data.isHighlighted
                                        ? "bg-blue-50 border-[3px] border-blue-400 shadow-md"
                                        : isParentNode
                                            ? `bg-slate-50 ${borderClass} border-slate-300 hover:border-slate-400`
                                            : `bg-white ${borderClass} border-slate-200 hover:border-slate-300`
                    }
        `}
                onClick={(e) => {
                    if (isClickableDirection && data.onDirectionClick && !data.isLoading) {
                        e.stopPropagation();
                        data.onDirectionClick();
                    } else if (data.onNodeClick) {
                        // Explicitly call node click handler for dismissal/selection
                        data.onNodeClick();
                    }
                }}
            >
                {/* Crawling Ants Border Effect for Exploring Nodes */}
                {data.isLoading && (
                    <svg
                        className="absolute inset-[calc(-3px)] w-[calc(100%+6px)] h-[calc(100%+6px)] pointer-events-none overflow-visible z-10"
                    >
                        <rect
                            x="1.5"
                            y="1.5"
                            width="calc(100% - 3px)"
                            height="calc(100% - 3px)"
                            fill="none"
                            stroke="#3b82f6" // blue-500
                            strokeWidth="5"
                            strokeDasharray="4 4"
                            rx={data.isRoot ? 9999 : isParentNode ? 12 : 8} // Match standard radius: rounded-xl=12px, rounded-lg=8px
                            className="animate-marching-ants"
                        />
                    </svg>
                )}

                {/* Notification Dot for unread nodes OR beacon active (Center Dot) */}

                {(data.isBeaconActive) && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 z-20 pointer-events-none">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500 shadow-sm border border-white"></span>
                    </span>
                )}

                {/* Target Handle - not needed for root node (has no parent) */}
                {!data.isRoot && (
                    <Handle type="target" position={targetPosition || Position.Top} className="!bg-slate-400" />
                )}

                {/* Node Content */}
                <>
                    {/* Node label */}
                    <div className={`${textClass} text-center flex-1 ${data.isRoot ? "text-white" : data.isLoading ? "text-blue-600" : isParentNode ? "text-slate-700" : "text-slate-600"}`}>
                        {data.label}
                    </div>

                    {/* Explore icon for direction nodes - on right inside node */}
                    {isClickableDirection && (
                        <div className={`
                            flex-shrink-0 w-5 h-5 ml-1 transition-all duration-200
                            ${data.isLoading
                                ? 'text-blue-500 animate-spin-pulse'
                                : 'text-blue-400 hover:text-blue-600 hover:scale-110 active:scale-95 active:text-blue-700'
                            }
                        `}>
                            <Compass className="w-full h-full" strokeWidth={2} />
                        </div>
                    )}
                </>

                {/* Source Handle for nodes WITHOUT children (leaf nodes) */}
                {!data.hasChildren && (
                    <Handle type="source" position={sourcePosition || Position.Bottom} className="!bg-slate-400" />
                )}
            </div>

            {/* Floating expand/collapse chevron OUTSIDE the node - with source Handle inside */}
            {data.hasChildren && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        data.onToggleCollapse?.();
                    }}
                    className={`
            relative flex items-center justify-center cursor-pointer
            transition-all duration-200 ease-out
            ${isHorizontal
                            ? 'ml-1 w-6 h-8'
                            : 'mt-1 w-8 h-6'
                        }
            ${data.isRoot
                            ? "text-slate-500 hover:text-slate-700 hover:scale-110 active:scale-95 active:text-slate-800"
                            : "text-slate-400 hover:text-slate-600 hover:scale-110 active:scale-95 active:text-slate-800"
                        }
          `}
                >
                    {/* Source Handle - centered in the chevron button */}
                    <Handle
                        type="source"
                        position={sourcePosition || (isHorizontal ? Position.Right : Position.Bottom)}
                        className="!bg-slate-400"
                    />

                    {/* Chevron icon */}
                    {data.isCollapsed ? getExpandIcon() : getCollapseIcon()}
                </button>
            )}

            {/* Collapsed children indicator dots */}
            {showCollapsedDots && (
                <div className={`
          flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full
          ${isHorizontal ? 'ml-1' : 'mt-2'}
        `}>
                    {Array.from({ length: Math.min(data.childCount ?? 0, 5) }).map((_, i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-slate-400"
                        />
                    ))}
                    {(data.childCount ?? 0) > 5 && (
                        <span className="text-xs text-slate-500 ml-0.5">+{(data.childCount ?? 0) - 5}</span>
                    )}
                </div>
            )}
        </div>
    );
}
