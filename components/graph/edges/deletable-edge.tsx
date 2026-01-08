"use client";

import React, { useState, useCallback, useRef } from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    type EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';

export interface DeletableEdgeData extends Record<string, unknown> {
    onDelete?: () => void;
    canDelete?: boolean;
    direction?: 'TB' | 'LR';
    isNodeHovered?: boolean; // True when the target node is being hovered
}

/**
 * Custom edge component with a delete button centered on the edge.
 * The delete button appears on hover (edge or node) and allows "cutting" the branch.
 * 
 * - Button appears when hovering over any part of the edge
 * - Button appears when hovering over the target node
 * - Button appears on active/highlighted edges when hovered
 * - Deletion is disabled when canDelete is false (e.g., during exploration)
 */
export function DeletableEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}: EdgeProps) {
    const [isEdgeHovered, setIsEdgeHovered] = useState(false);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Get the bezier path and label position
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const edgeData = data as DeletableEdgeData | undefined;
    const canDelete = edgeData?.canDelete ?? true;
    const onDelete = edgeData?.onDelete;
    const isNodeHovered = edgeData?.isNodeHovered ?? false;

    // Show button if either edge is hovered or target node is hovered
    const showButton = isEdgeHovered || isNodeHovered;

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (canDelete && onDelete) {
            onDelete();
        }
    }, [canDelete, onDelete]);

    // Use debounced hover to prevent flickering
    const handleMouseEnter = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setIsEdgeHovered(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        // Small delay before hiding to prevent flicker when moving between elements
        hoverTimeoutRef.current = setTimeout(() => {
            setIsEdgeHovered(false);
        }, 100);
    }, []);

    return (
        <g
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Invisible wider path for easier hover detection - covers entire edge */}
            <path
                d={edgePath}
                fill="none"
                strokeWidth={50}
                stroke="transparent"
                style={{ cursor: 'pointer' }}
            />

            {/* Visible edge - keep original styling */}
            <BaseEdge
                id={id}
                path={edgePath}
                style={style}
                markerEnd={markerEnd}
            />

            {/* Delete button - centered on edge, always high z-index */}
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                        zIndex: 10000, // Above all edges
                    }}
                    className="nodrag nopan"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <button
                        onClick={handleDelete}
                        disabled={!canDelete}
                        className={`
                            flex items-center justify-center
                            w-6 h-6 rounded-full
                            transition-all duration-200 ease-out
                            ${showButton
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 scale-75 pointer-events-none'
                            }
                            ${canDelete
                                ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer shadow-md hover:shadow-lg'
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            }
                        `}
                        title={canDelete ? "Delete this branch" : "Cannot delete while exploring"}
                    >
                        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                </div>
            </EdgeLabelRenderer>
        </g>
    );
}
