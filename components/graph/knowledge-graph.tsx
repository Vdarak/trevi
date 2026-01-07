"use client";

import React, { useCallback, useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Position,
  Handle,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, Layers, ArrowDown, ArrowRight, MessageSquare, X, Plus, Minus, Maximize2, Compass, PanelRight, Maximize } from 'lucide-react';
import { CompleteEvent, MessagePayload, Citation } from '@/lib/api';
import { TreviLogoAnimation, TreviLogoStatic } from '@/components/ui/trevi-logo';
import { hierarchy, tree } from 'd3-hierarchy';
import { NodeConversationPanel, NodeConversationModal } from '@/components/chat/node-conversation-panel';

// ============================================================================
// Types
// ============================================================================

export interface GraphNode {
  id: string;
  label: string;
  summary?: string;
  parentId: string | null;
  isDirection?: boolean; // True if this is a direction node (clickable to explore)
  payload?: Array<{ role: 'user' | 'assistant'; content: string }>; // Message history for this node
  citations?: Citation[]; // Citation data with snippets for this node
}

export interface KnowledgeGraphProps {
  nodes: GraphNode[];
  rootNodeId?: string; // Primary root for single-root backward compatibility
  rootNodeIds?: string[]; // Multiple roots for multi-graph support
  onNodeClick?: (nodeId: string) => void;
  onDirectionClick?: (nodeId: string) => void; // Callback for clicking direction nodes
  loadingNodeId?: string | null; // Node ID currently being loaded
  onToggleChatSidebar?: () => void; // Toggle full conversation sidebar
  isChatSidebarOpen?: boolean; // Whether the chat sidebar is open
  initialActiveNodeId?: string | null; // Active node to highlight on initial load
  onNodeMessage?: (nodeId: string, message: string) => void; // Callback for sending message from node panel
  isNodeStreaming?: boolean; // Whether a node panel is currently streaming
  nodeStatusMessage?: string; // Status message for node panel streaming
  // Global status indicator
  globalStatus?: {
    isActive: boolean;
    message: string;
    type: 'streaming' | 'exploring' | 'idle';
    activeNodeLabel?: string;
    exploringNodeLabel?: string; // Label of the direction node being explored
  };
}

// ============================================================================
// Layout Configuration
// ============================================================================

const NODE_HEIGHT = 50;
const SIBLING_SEP = 60;  // Tight spacing between leaf siblings
const SUBTREE_SEP = 140; // Larger spacing between different subtrees
const RANK_SEP = 120; // Vertical spacing between levels

// Helper to estimate node width based on label length
function getNodeWidth(label: string): number {
  // Base width (padding + icon space) + approx char width (10px)
  // Min width 200px to maintain consistency for short labels
  return Math.max(200, (label?.length || 0) * 10 + 80);
}

/**
 * Custom tree layout algorithm that ensures each subtree stays within its own 
 * horizontal space, preventing children from invading sibling node territories.
 * 
 * This creates a proper hierarchical tree where:
 * - Each node's descendants stay in a dedicated vertical column
 * - Sister nodes never have overlapping subtrees
 * - Parent nodes are centered over their children
 * 
 * Supports multiple disconnected trees (multiple root nodes).
 */
function getTreeLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const isLR = direction === 'LR';

  // Build parent-child relationships
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();

  edges.forEach((edge) => {
    parentMap.set(edge.target, edge.source);
    const children = childrenMap.get(edge.source) || [];
    children.push(edge.target);
    childrenMap.set(edge.source, children);
  });

  // Find ALL root nodes (nodes without parents)
  const rootIds = nodes.filter((n) => !parentMap.has(n.id)).map(n => n.id);
  if (rootIds.length === 0) return { nodes, edges };

  // Calculate the breadth (width in TB, height in LR) each subtree needs
  const subtreeBreadths = new Map<string, number>();

  function calculateSubtreeBreadth(nodeId: string): number {
    const children = childrenMap.get(nodeId) || [];
    const node = nodes.find(n => n.id === nodeId);

    // In TB, breadth is width. In LR, breadth is height.
    const nodeBreadth = isLR ? NODE_HEIGHT : (node ? getNodeWidth(node.data.label as string) : 180);

    if (children.length === 0) {
      subtreeBreadths.set(nodeId, nodeBreadth);
      return nodeBreadth;
    }

    let totalBreadth = 0;
    children.forEach((childId, index) => {
      totalBreadth += calculateSubtreeBreadth(childId);
      if (index < children.length - 1) {
        const isLeaf = (childrenMap.get(childId) || []).length === 0;
        const nextChildId = children[index + 1];
        const nextIsLeaf = (childrenMap.get(nextChildId) || []).length === 0;

        const spacing = (isLeaf && nextIsLeaf) ? SIBLING_SEP : SUBTREE_SEP;
        totalBreadth += spacing;
      }
    });

    const breadth = Math.max(totalBreadth, nodeBreadth);
    subtreeBreadths.set(nodeId, breadth);
    return breadth;
  }

  // Calculate breadth for all trees
  rootIds.forEach(rootId => calculateSubtreeBreadth(rootId));

  // Position nodes
  const positions = new Map<string, { x: number; y: number }>();

  function positionNode(nodeId: string, x: number, y: number) {
    const subtreeBreadth = subtreeBreadths.get(nodeId) || 180;
    const node = nodes.find(n => n.id === nodeId);
    const nodeBreadth = isLR ? NODE_HEIGHT : (node ? getNodeWidth(node.data.label as string) : 180);
    const nodeDepth = isLR ? (node ? getNodeWidth(node.data.label as string) : 180) : NODE_HEIGHT;

    // Center this node in its allocated subtree space (breadth-wise)
    // In TB: x is breadth, y is depth
    // In LR: y is breadth, x is depth

    if (isLR) {
      // LR: x is depth, y is breadth
      const nodeY = y + (subtreeBreadth - nodeBreadth) / 2;
      positions.set(nodeId, { x, y: nodeY });
    } else {
      // TB: x is breadth, y is depth
      const nodeX = x + (subtreeBreadth - nodeBreadth) / 2;
      positions.set(nodeId, { x: nodeX, y });
    }

    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return;

    // Position children
    // Start from "left" (top in LR) of this node's subtree space
    let currentBreadth = isLR ? y : x;

    // Depth increases by node depth + rank sep
    const nextDepth = (isLR ? x : y) + nodeDepth + RANK_SEP;

    children.forEach((childId, index) => {
      const childSubtreeBreadth = subtreeBreadths.get(childId) || 180;

      if (isLR) {
        positionNode(childId, nextDepth, currentBreadth);
      } else {
        positionNode(childId, currentBreadth, nextDepth);
      }

      if (index < children.length - 1) {
        const isLeaf = (childrenMap.get(childId) || []).length === 0;
        const nextChildId = children[index + 1];
        const nextIsLeaf = (childrenMap.get(nextChildId) || []).length === 0;

        const spacing = (isLeaf && nextIsLeaf) ? SIBLING_SEP : SUBTREE_SEP;
        currentBreadth += childSubtreeBreadth + spacing;
      }
    });
  }

  // Calculate total breadth across all trees to center them
  let totalAllTreesBreadth = 0;
  const treeBreadths: number[] = [];
  rootIds.forEach((rootId, index) => {
    const treeBreadth = subtreeBreadths.get(rootId) || 180;
    treeBreadths.push(treeBreadth);
    totalAllTreesBreadth += treeBreadth;
    if (index < rootIds.length - 1) {
      totalAllTreesBreadth += SUBTREE_SEP * 2; // Extra spacing between different trees
    }
  });

  // Position each tree, spacing them out horizontally (TB) or vertically (LR)
  let currentTreeOffset = -totalAllTreesBreadth / 2;
  rootIds.forEach((rootId, index) => {
    const treeBreadth = treeBreadths[index];
    
    if (isLR) {
      positionNode(rootId, 0, currentTreeOffset);
    } else {
      positionNode(rootId, currentTreeOffset, 0);
    }
    
    currentTreeOffset += treeBreadth;
    if (index < rootIds.length - 1) {
      currentTreeOffset += SUBTREE_SEP * 2; // Extra spacing between trees
    }
  });

  // Apply positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      targetPosition: isLR ? Position.Left : Position.Top,
      sourcePosition: isLR ? Position.Right : Position.Bottom,
      position: pos,
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Tidy tree layout using d3-hierarchy's Reingold-Tilford algorithm.
 * This produces a more compact and balanced tree structure.
 * 
 * Supports multiple disconnected trees (multiple root nodes).
 */
function getTidyTreeLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const isLR = direction === 'LR';

  // Build parent-child relationships to find roots and build hierarchy
  const childMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();

  edges.forEach((edge) => {
    parentMap.set(edge.target, edge.source);
    const children = childMap.get(edge.source) || [];
    children.push(edge.target);
    childMap.set(edge.source, children);
  });

  // Find ALL root nodes (nodes without parents)
  const rootNodes = nodes.filter((n) => !parentMap.has(n.id));
  if (rootNodes.length === 0) return { nodes, edges };

  // Position map for all nodes
  const allPositions = new Map<string, { x: number; y: number }>();

  // Process each tree separately and track their bounds
  const treeBounds: Array<{ minBreadth: number; maxBreadth: number }> = [];
  
  rootNodes.forEach((rootNode) => {
    // Create D3 hierarchy for this tree
    const d3Root = hierarchy(rootNode, (d) => {
      const childrenIds = childMap.get(d.id);
      return childrenIds?.map(id => nodes.find(n => n.id === id)!) || null;
    });

    // Configure tree layout
    const treeLayout = tree<Node>();

    if (isLR) {
      // Calculate max width per depth level for this tree
      const depthWidths = new Map<number, number>();
      d3Root.each((node) => {
        const width = getNodeWidth(node.data.data.label as string);
        const currentMax = depthWidths.get(node.depth) || 0;
        depthWidths.set(node.depth, Math.max(currentMax, width));
      });

      treeLayout
        .nodeSize([NODE_HEIGHT, 1])
        .separation((a, b) => {
          return (a.parent === b.parent ? SIBLING_SEP : SUBTREE_SEP) / NODE_HEIGHT + 1;
        });

      treeLayout(d3Root);

      // Fix X coordinates (depth) based on max widths
      d3Root.each((node) => {
        let x = 0;
        for (let i = 0; i < node.depth; i++) {
          x += (depthWidths.get(i) || 180) + RANK_SEP;
        }
        node.y = x;
      });

    } else {
      // TB Layout
      treeLayout
        .nodeSize([1, NODE_HEIGHT + RANK_SEP])
        .separation((a, b) => {
          const widthA = getNodeWidth(a.data.data.label as string);
          const widthB = getNodeWidth(b.data.data.label as string);
          const distance = (widthA + widthB) / 2 + (a.parent === b.parent ? SIBLING_SEP : SUBTREE_SEP);
          return distance;
        });

      treeLayout(d3Root);
    }

    // Calculate bounds for this tree
    let minBreadth = Infinity;
    let maxBreadth = -Infinity;
    d3Root.each((node) => {
      const breadth = isLR ? (node.x ?? 0) : (node.x ?? 0);
      minBreadth = Math.min(minBreadth, breadth);
      maxBreadth = Math.max(maxBreadth, breadth);
    });

    treeBounds.push({ minBreadth, maxBreadth });

    // Store positions temporarily (will offset later)
    d3Root.each((d3Node) => {
      allPositions.set(d3Node.data.id, isLR
        ? { x: d3Node.y ?? 0, y: d3Node.x ?? 0 }
        : { x: d3Node.x ?? 0, y: d3Node.y ?? 0 });
    });
  });

  // Calculate offsets to space out multiple trees
  if (rootNodes.length > 1) {
    let currentOffset = 0;
    
    rootNodes.forEach((rootNode, treeIndex) => {
      const bounds = treeBounds[treeIndex];
      const treeWidth = bounds.maxBreadth - bounds.minBreadth;
      const treeOffset = currentOffset - bounds.minBreadth;

      // Get all nodes in this tree
      const treeNodeIds = new Set<string>();
      function collectTreeNodes(nodeId: string) {
        treeNodeIds.add(nodeId);
        (childMap.get(nodeId) || []).forEach(collectTreeNodes);
      }
      collectTreeNodes(rootNode.id);

      // Apply offset to all nodes in this tree
      treeNodeIds.forEach((nodeId) => {
        const pos = allPositions.get(nodeId);
        if (pos) {
          if (isLR) {
            allPositions.set(nodeId, { x: pos.x, y: pos.y + treeOffset });
          } else {
            allPositions.set(nodeId, { x: pos.x + treeOffset, y: pos.y });
          }
        }
      });

      currentOffset += treeWidth + SUBTREE_SEP * 2; // Extra spacing between trees
    });

    // Center all trees
    const totalWidth = currentOffset - SUBTREE_SEP * 2;
    const centerOffset = -totalWidth / 2;
    allPositions.forEach((pos, nodeId) => {
      if (isLR) {
        allPositions.set(nodeId, { x: pos.x, y: pos.y + centerOffset });
      } else {
        allPositions.set(nodeId, { x: pos.x + centerOffset, y: pos.y });
      }
    });
  }

  // Map positions back to nodes
  const layoutedNodes = nodes.map((node) => {
    const pos = allPositions.get(node.id);
    if (pos) {
      return {
        ...node,
        targetPosition: isLR ? Position.Left : Position.Top,
        sourcePosition: isLR ? Position.Right : Position.Bottom,
        position: pos,
      };
    }
    return {
      ...node,
      position: { x: node.position?.x ?? 0, y: node.position?.y ?? 0 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Finds the path from a node to its root by traversing edges backwards.
 * Works with multiple roots - traverses until no parent is found.
 */
function findPathToRoot(
  nodeId: string,
  edges: Edge[],
  rootIds: string[] | string // Accept single root for backwards compat or array
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>([nodeId]);
  const edgeIds = new Set<string>();
  const rootIdSet = new Set(Array.isArray(rootIds) ? rootIds : [rootIds]);

  // Build parent map from edges
  const parentMap = new Map<string, { parentId: string; edgeId: string }>();
  edges.forEach((edge) => {
    parentMap.set(edge.target, { parentId: edge.source, edgeId: edge.id });
  });

  // Traverse up to root (stop when we reach any root or no parent)
  let currentId = nodeId;
  while (!rootIdSet.has(currentId) && parentMap.has(currentId)) {
    const parent = parentMap.get(currentId)!;
    nodeIds.add(parent.parentId);
    edgeIds.add(parent.edgeId);
    currentId = parent.parentId;
  }

  return { nodeIds, edgeIds };
}

/**
 * Gets all descendant node IDs for a given node.
 */
function getDescendants(nodeId: string, edges: Edge[]): Set<string> {
  const descendants = new Set<string>();
  const childMap = new Map<string, string[]>();

  edges.forEach((edge) => {
    const children = childMap.get(edge.source) || [];
    children.push(edge.target);
    childMap.set(edge.source, children);
  });

  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childMap.get(current) || [];
    children.forEach((child) => {
      descendants.add(child);
      queue.push(child);
    });
  }

  return descendants;
}

// ============================================================================
// Custom Node Component
// ============================================================================

interface ConceptNodeData {
  label: string;
  summary?: string;
  isHighlighted?: boolean;
  isInActivePath?: boolean; // Part of the path from active node to root
  isActiveNode?: boolean; // The currently clicked/active node
  isRoot?: boolean;
  isCollapsed?: boolean;
  hasChildren?: boolean;
  childCount?: number; // Number of children for collapsed indicator
  isDirection?: boolean;
  isLoading?: boolean;
  parentId?: string | null; // Added for animation logic
  direction?: 'TB' | 'LR'; // Layout direction for positioning floating chevron
  depth?: number; // Depth in tree (0 = root, 1 = first level, etc.)
  isExpanded?: boolean; // True if showing inline conversation
  messages?: MessagePayload[]; // Messages to show when expanded
  onToggleCollapse?: () => void;
  onDirectionClick?: () => void;
  onExpand?: () => void;
  onCloseExpanded?: () => void;
  [key: string]: unknown;
}

// Sharp Chevron Icons for floating expand/collapse button
function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
      <path d="M9 6L15 12L9 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
      <path d="M15 6L9 12L15 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9L12 15L18 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronUpIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
      <path d="M18 15L12 9L6 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExploreIcon({ className = "" }: { className?: string }) {
  return <Compass className={`w-full h-full ${className}`} strokeWidth={2} />;
}

// Helper function to find snippet for a citation
function findSnippetForCitation(citationIndex: number, citations?: Citation[]): string | null {
  if (!citations) return null;

  // Find the citation with matching index
  const citation = citations.find(c => c.index === citationIndex);
  if (!citation || !citation.occurrences || citation.occurrences.length === 0) {
    return null;
  }

  // Return the snippet from the first occurrence
  const snippet = citation.occurrences[0].snippet;
  return snippet && snippet !== "Source paragraph not found" ? snippet : null;
}

// Citation tooltip component - uses portal for proper positioning outside overflow containers
function CitationTooltipGraph({
  index,
  content,
  title = 'Source',
  url
}: {
  index: string;
  content: string;
  title?: string;
  url?: string;
}) {
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number; side: 'top' | 'bottom'; ready: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Only render portal on client side
  useEffect(() => {
    setMounted(true);
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Handle hover with debounce
  const handleMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Debounce hide by 150ms so user can move to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setPosition(null);
    }, 150);
  }, []);

  // Calculate position when tooltip becomes visible
  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 8;
    const offset = 6;

    let x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    let y: number;
    let side: 'top' | 'bottom' = 'top';

    // Try above first
    const topY = triggerRect.top - tooltipRect.height - offset;
    const bottomY = triggerRect.bottom + offset;

    if (topY >= padding) {
      y = topY;
      side = 'top';
    } else if (bottomY + tooltipRect.height <= vh - padding) {
      y = bottomY;
      side = 'bottom';
    } else {
      const spaceAbove = triggerRect.top;
      const spaceBelow = vh - triggerRect.bottom;
      if (spaceAbove >= spaceBelow) {
        y = padding;
        side = 'top';
      } else {
        y = vh - tooltipRect.height - padding;
        side = 'bottom';
      }
    }

    x = Math.max(padding, Math.min(x, vw - tooltipRect.width - padding));
    
    // Use requestAnimationFrame to ensure we set ready after the browser has painted
    requestAnimationFrame(() => {
      setPosition({ x, y, side, ready: true });
    });
  }, [isVisible]);

  // Handle click to open URL
  const handleClick = useCallback(() => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [url]);

  return (
    <span 
      ref={triggerRef as React.RefObject<HTMLSpanElement>}
      className="cursor-pointer"
      style={{ verticalAlign: 'super', display: 'inline', margin: '0 1px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[9px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors" style={{ verticalAlign: 'super' }}>
        {index}
      </span>
      {/* Tooltip rendered via portal to escape overflow containers */}
      {mounted && isVisible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed w-56 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden pointer-events-auto"
          style={{ 
            // Render off-screen initially for measurement, then move to position
            left: position?.ready ? position.x : -9999,
            top: position?.ready ? position.y : -9999,
            zIndex: 99999,
            opacity: position?.ready ? 1 : 0,
            transform: position?.ready 
              ? 'scale(1) translateY(0)' 
              : `scale(0.95) translateY(${position?.side === 'bottom' ? '-4px' : '4px'})`,
            transition: position?.ready ? 'opacity 150ms ease-out, transform 150ms ease-out' : 'none',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div 
            className="overflow-y-auto px-2.5 py-2 text-[10px] text-slate-700 leading-relaxed"
            style={{ maxHeight: '120px', scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
          >
            {content}
          </div>
          <div className="px-2.5 py-1 bg-slate-50 border-t border-slate-100 flex items-center gap-1">
            <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="text-[9px] text-slate-500 truncate font-medium">{title}</span>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}




// Simple markdown renderer for conversation messages with citation support
function renderSimpleMarkdown(text: string, citationsData?: Citation[]): React.ReactNode {
  let processedText = text;

  // FIRST: Handle standalone reference numbers [n] BEFORE other processing
  // This prevents them from being captured by other patterns
  processedText = processedText.replace(/\[\s*(\d+)\s*\]/g, '__REF_$1__');

  // SECOND: Protect markdown links by replacing them with placeholders
  const links: { text: string; url: string }[] = [];
  processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    links.push({ text: linkText, url });
    return `__LINK_${links.length - 1}__`;
  });

  // THIRD: Extract citations [index: title] - must have colon
  // Also remove any parenthesized URL immediately following the citation
  const extractedCitations: { index: string; title: string }[] = [];
  processedText = processedText.replace(/\[(\d+):\s*([^\]]+)\](?:\s*\([^)]+\))?/g, (match, index, title) => {
    extractedCitations.push({ index, title: title.trim() });
    return `__CITATION_${extractedCitations.length - 1}__`;
  });

  // Also strip any remaining standalone parenthesized URLs (http/https links in parentheses)
  processedText = processedText.replace(/\s*\(https?:\/\/[^)]+\)/g, '');

  // FOURTH: Restore standalone reference numbers as styled bubbles
  processedText = processedText.replace(/__REF_(\d+)__/g, '<span class="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[9px] font-medium bg-blue-100 text-blue-700 rounded cursor-pointer" style="vertical-align: super; margin: 0 1px;">$1</span>');

  // Handle bold **text**
  processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Handle italic *text*
  processedText = processedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Handle inline code `code`
  processedText = processedText.replace(/`([^`]+)`/g, '<code class="bg-slate-200/50 px-1 rounded text-[10px]">$1</code>');
  // Handle headers ### text
  processedText = processedText.replace(/^###\s+(.+)$/gm, '<strong class="text-slate-700">$1</strong>');
  processedText = processedText.replace(/^##\s+(.+)$/gm, '<strong class="text-slate-800">$1</strong>');
  // Handle numbered lists and bullet points
  processedText = processedText.replace(/^\d+\.\s+/gm, '• ');
  processedText = processedText.replace(/^-\s+/gm, '• ');

  // FOURTH: Restore links with proper HTML
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    processedText = processedText.replace(
      `__LINK_${i}__`,
      `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline cursor-pointer">${link.text}</a>`
    );
  }

  // If no citations, use simple HTML rendering
  if (extractedCitations.length === 0) {
    return <span dangerouslySetInnerHTML={{ __html: processedText }} />;
  }

  // Split by citation placeholders and interleave with citation components
  const parts = processedText.split(/__CITATION_(\d+)__/);
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Regular text
      if (parts[i]) {
        elements.push(<span key={`text-${i}`} dangerouslySetInnerHTML={{ __html: parts[i] }} />);
      }
    } else {
      // Citation index
      const citationArrayIndex = parseInt(parts[i], 10);
      const citation = extractedCitations[citationArrayIndex];
      if (citation) {
        const citationNumber = parseInt(citation.index, 10);
        const snippet = findSnippetForCitation(citationNumber, citationsData);
        const tooltipContent = snippet || citation.title;
        // Find URL from citations data
        const citationData = citationsData?.find(c => c.index === citationNumber);
        const citationUrl = citationData?.url;

        elements.push(
          <CitationTooltipGraph
            key={`cite-${i}`}
            index={citation.index}
            content={tooltipContent}
            url={citationUrl}
          />
        );
      }
    }
  }

  return <>{elements}</>;
}


function ConceptNode({ data, targetPosition, sourcePosition }: { data: ConceptNodeData, targetPosition?: Position, sourcePosition?: Position }) {
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

  // Render normal node view
  return (
    <div className={`relative ${isHorizontal ? 'flex items-center' : 'flex flex-col items-center'}`}>
      {/* Main node box */}
      <div
        className={`
          relative ${sizeClass} ${radiusClass} ${shadowClass} transition-all duration-200 flex items-center gap-3 whitespace-nowrap
          ${data.isRoot
            ? data.isInActivePath || data.isActiveNode
              ? "bg-slate-900 text-white border-[3px] border-blue-500"
              : "bg-slate-900 text-white border-[3px] border-slate-900"
            : data.isLoading
              ? "bg-blue-50 border-[3px] border-blue-300"
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
          }
        }}
      >
        {/* Target Handle - not needed for root node (has no parent) */}
        {!data.isRoot && (
          <Handle type="target" position={targetPosition || Position.Top} className="!bg-slate-400" />
        )}

        {/* Loading animation - rotating explore icon */}
        {data.isLoading && !isClickableDirection && (
          <div className="flex-shrink-0 w-5 h-5 text-blue-500 animate-spin-pulse">
            <ExploreIcon />
          </div>
        )}

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
            <ExploreIcon />
          </div>
        )}

        {/* Source Handle for nodes WITHOUT children (leaf nodes) */}
        {!data.hasChildren && (
          <Handle type="source" position={sourcePosition || Position.Bottom} className="!bg-slate-400" />
        )}
      </div>

      {/* Floating expand/collapse chevron OUTSIDE the node - with source Handle inside */}
      {data.hasChildren && !data.isLoading && (
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

// ============================================================================
// Conversation Panel Node - Renders as a proper React Flow node
// ============================================================================

interface ConversationPanelNodeData {
  messages: MessagePayload[];
  label: string;
  onClose: () => void;
  citations?: Citation[];
  onSendMessage?: (message: string) => void;
  isStreaming?: boolean;
  statusMessage?: string;
}

/**
 * Conversation panel with title bar, content, and chat input.
 * Appears attached to nodes in the graph.
 */
function ConversationPanelNode({ data }: { data: ConversationPanelNodeData }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter and combine only assistant messages
  const aiContent = useMemo(() => {
    const assistantMessages = data.messages.filter(msg => msg.role === 'assistant');
    return assistantMessages.map(m => m.content).join('\n\n');
  }, [data.messages]);

  // Prevent wheel events from propagating to React Flow (which would zoom the canvas)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputValue.trim() && !data.isStreaming && data.onSendMessage) {
      data.onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  if (!aiContent) return null;

  return (
    <div
      className="w-[400px] max-h-[500px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-scale-in flex flex-col"
      onWheelCapture={handleWheel}
    >
      {/* Target Handle on left - for edge connection */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-0 !rounded-full"
        style={{ left: -5 }}
      />

      {/* Header with title and close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <h3 className="font-semibold text-slate-800 text-sm truncate pr-4 flex-1">
          {data.label || 'Conversation'}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onClose();
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable AI content - clean reading experience */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 text-sm text-slate-700 leading-relaxed"
        style={{ maxHeight: '350px', scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
      >
        {renderSimpleMarkdown(aiContent, data.citations)}
      </div>

      {/* Chat input */}
      {data.onSendMessage && (
        <div className="border-t border-slate-100 p-3 bg-white flex-shrink-0">
          {data.isStreaming && data.statusMessage && (
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
              <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              <span>{data.statusMessage}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Ask a follow-up..."
              disabled={data.isStreaming}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || data.isStreaming}
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Type assertion for nodeTypes to work with React Flow
const nodeTypes = {
  concept: ConceptNode,
  conversationPanel: ConversationPanelNode,
} as const;

// ============================================================================
// Tooltip Component with Collision Detection
// ============================================================================

interface TooltipProps {
  content: string;
  position: { x: number; y: number };
}

function Tooltip({ content, position }: TooltipProps) {
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

// ============================================================================
// Animation Hook
// ============================================================================

function useLayoutAnimation(
  targetNodes: Node[],
  targetEdges: Edge[],
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
  onAnimationComplete?: () => void
) {
  const { getNodes } = useReactFlow();
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startNodesRef = useRef<Map<string, Node>>(new Map());

  // We need to track the *previous* targetNodes to know if we should animate
  const prevTargetNodesRef = useRef<Node[]>([]);

  useEffect(() => {
    // Skip if targets haven't changed (deep comparison would be better but length/ids is a decent proxy)
    // For now, we rely on the dependency array which includes targetNodes from useMemo

    const currentNodes = getNodes();

    // If this is the first load (no current nodes), just set them immediately without animation
    if (currentNodes.length === 0) {
      setNodes(targetNodes);
      setEdges(targetEdges);
      prevTargetNodesRef.current = targetNodes;
      onAnimationComplete?.();
      return;
    }

    // 1. Setup Start Positions
    const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]));
    const startNodeMap = new Map<string, Node>();
    const exitingNodes: Node[] = [];
    
    // Preserve conversation panel nodes - they are managed separately
    const panelNodes = currentNodes.filter(n => n.type === 'conversationPanel');

    // Identify exiting nodes (present in current but not in target)
    // Exclude conversation panel nodes - they have their own lifecycle
    const targetNodeIds = new Set(targetNodes.map(n => n.id));
    currentNodes.forEach(node => {
      if (!targetNodeIds.has(node.id) && node.type !== 'conversationPanel') {
        exitingNodes.push(node);
      }
    });

    // For every target node, determine its start position
    targetNodes.forEach(targetNode => {
      if (currentNodeMap.has(targetNode.id)) {
        // Existing node: start from current position
        startNodeMap.set(targetNode.id, currentNodeMap.get(targetNode.id)!);
      } else {
        // New node: "Sprout" from parent
        const parentId = targetNode.data.parentId as string;
        let startPos = { x: 0, y: 0 };

        // Try to find parent in current nodes
        if (parentId && currentNodeMap.has(parentId)) {
          startPos = currentNodeMap.get(parentId)!.position;
        } else if (parentId && startNodeMap.has(parentId)) {
          // Parent is also new, use its start pos (which might be grandparent)
          startPos = startNodeMap.get(parentId)!.position;
        } else {
          // Fallback: try to find a "closest" ancestor or just root
          const root = currentNodes.find(n => n.data.isRoot);
          if (root) startPos = root.position;
        }

        startNodeMap.set(targetNode.id, {
          ...targetNode,
          position: { ...startPos },
          style: { ...targetNode.style, opacity: 0.5 } // Start at 50% opacity
        });
      }
    });

    // Setup Exit Targets for exiting nodes
    const exitNodeMap = new Map<string, { start: Node, targetPos: { x: number, y: number } }>();
    exitingNodes.forEach(node => {
      const parentId = node.data.parentId as string;
      let targetPos = node.position; // Default to stay in place if parent not found

      // Find parent in targetNodes to know where to shrink to
      const parentInTarget = targetNodes.find(n => n.id === parentId);
      if (parentInTarget) {
        targetPos = parentInTarget.position;
      } else {
        // If parent is also exiting, try to find the nearest ancestor that remains
        let curr = node;
        while (curr.data.parentId) {
          const pId = curr.data.parentId as string;
          const pTarget = targetNodes.find(n => n.id === pId);
          if (pTarget) {
            targetPos = pTarget.position;
            break;
          }
          // If parent not in target, try to find parent in current to continue up
          const pCurrent = currentNodeMap.get(pId);
          if (!pCurrent) break;
          curr = pCurrent;
        }
      }
      exitNodeMap.set(node.id, { start: node, targetPos });
    });

    startNodesRef.current = startNodeMap;

    // 2. Start Animation Loop
    const duration = 1200; // ms - slower for smoother expand/collapse

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

      // Ease out cubic: 1 - (1-t)^3
      const t = 1 - Math.pow(1 - progress, 3);

      // Animate entering/updating nodes
      const nextTargetNodes = targetNodes.map(targetNode => {
        const startNode = startNodesRef.current.get(targetNode.id);

        // If something went wrong and we don't have a start node, just jump to target
        if (!startNode) return targetNode;

        const startOpacity = Number(startNode.style?.opacity ?? 1);
        const targetOpacity = Number(targetNode.style?.opacity ?? 1);

        // Optimization: If node is already at target position and opacity, return the targetNode reference directly
        // This prevents unnecessary re-renders for stationary nodes
        const dx = targetNode.position.x - startNode.position.x;
        const dy = targetNode.position.y - startNode.position.y;
        const dOpacity = targetOpacity - startOpacity;

        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(dOpacity) < 0.01) {
          return targetNode;
        }

        return {
          ...targetNode,
          position: {
            x: startNode.position.x + dx * t,
            y: startNode.position.y + dy * t,
          },
          // Fade in opacity if it was < 1
          style: {
            ...targetNode.style,
            opacity: startOpacity + dOpacity * t
          }
        };
      });

      // Animate exiting nodes
      const nextExitingNodes = exitingNodes.map(node => {
        const exitData = exitNodeMap.get(node.id);
        if (!exitData) return node;

        return {
          ...node,
          position: {
            x: exitData.start.position.x + (exitData.targetPos.x - exitData.start.position.x) * t,
            y: exitData.start.position.y + (exitData.targetPos.y - exitData.start.position.y) * t,
          },
          style: {
            ...node.style,
            opacity: 1 - t, // Fade out to 0
            pointerEvents: 'none' as const, // Disable interaction while exiting
          }
        };
      });

      setNodes([...nextTargetNodes, ...nextExitingNodes, ...panelNodes]);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = null;
        // Final state: target nodes + preserved panel nodes
        setNodes([...targetNodes, ...panelNodes]);
        onAnimationComplete?.();
      }
    };

    // Cancel previous animation
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    startTimeRef.current = null;
    animationFrameRef.current = requestAnimationFrame(animate);

    // Update edges immediately - preserve panel edges while updating target edges
    setEdges(currentEdges => {
      const panelEdges = currentEdges.filter(e => e.id.startsWith('panel-edge-'));
      // Filter out any panel edges from targetEdges to avoid duplicates
      const nonPanelTargetEdges = targetEdges.filter(e => !e.id.startsWith('panel-edge-'));
      return [...nonPanelTargetEdges, ...panelEdges];
    });

    prevTargetNodesRef.current = targetNodes;

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [targetNodes, targetEdges, setNodes, setEdges, getNodes]); // Dependencies ensure this runs when layout changes
}

// ============================================================================
// Main Component
// ============================================================================

// Inner component that has access to useReactFlow
function KnowledgeGraphInner({ nodes: graphNodes, rootNodeId, onNodeClick, onDirectionClick, loadingNodeId, onToggleChatSidebar, isChatSidebarOpen, initialActiveNodeId, onNodeMessage, isNodeStreaming, nodeStatusMessage, globalStatus }: KnowledgeGraphProps) {
  const { fitView, fitBounds, getViewport, zoomIn, zoomOut, getNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<'custom' | 'tidy'>('custom');
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(initialActiveNodeId || null); // Track clicked/active node for persistent path highlighting
  const [viewMode, setViewMode] = useState<'panel' | 'modal'>('modal'); // Toggle between panel and modal view

  // Modal state for center modal view
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    nodeId: string;
    label: string;
    messages: MessagePayload[];
    citations?: Citation[];
    clickPosition?: { x: number; y: number }; // Screen position where user clicked
  } | null>(null);

  // Node conversation panel state - uses FLOW coordinates to pan/zoom with graph
  const [selectedNodePanel, setSelectedNodePanel] = useState<{
    nodeId: string;
    label: string;
    messages: MessagePayload[];
    flowPosition: { x: number; y: number }; // Flow coordinates (not screen)
    nodeWidth: number;
  } | null>(null);


  // Track viewport for reactive panel positioning
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Track if we've done the initial fitView
  const hasInitialFitRef = useRef(false);
  // Track previous loading state to detect completion
  const prevLoadingRef = useRef(false);
  // Track previous node count
  const prevNodeCountRef = useRef(0);
  // Track previous rootNodeId to detect chat changes
  const prevRootNodeIdRef = useRef<string | undefined>(undefined);

  // Reset initial fit flag when rootNodeId changes (new chat loaded)
  useEffect(() => {
    if (rootNodeId !== prevRootNodeIdRef.current) {
      hasInitialFitRef.current = false;
      prevRootNodeIdRef.current = rootNodeId;
    }
  }, [rootNodeId]);

  // Sync activeNodeId with initialActiveNodeId prop when it changes (e.g., loading different chat)
  useEffect(() => {
    if (initialActiveNodeId !== undefined) {
      setActiveNodeId(initialActiveNodeId);
    }
  }, [initialActiveNodeId]);

  // Auto-fit view when loading completes or new nodes are added
  useEffect(() => {
    const isLoading = !!loadingNodeId;
    const wasLoading = prevLoadingRef.current;
    const nodeCount = graphNodes.length;
    const prevNodeCount = prevNodeCountRef.current;

    // Trigger fitView if:
    // 1. Loading just finished (wasLoading=true, isLoading=false)
    // 2. New nodes were added (nodeCount > prevNodeCount) AND we are not currently loading
    if ((wasLoading && !isLoading) || (nodeCount > prevNodeCount && !isLoading)) {
      setTimeout(() => {
        fitView({ padding: 0.3, duration: 600 });
      }, 100); // Small delay to ensure nodes are rendered
    }

    prevLoadingRef.current = isLoading;
    prevNodeCountRef.current = nodeCount;
  }, [loadingNodeId, graphNodes.length, fitView]);

  // Get the summary of hovered node
  const hoveredSummary = useMemo(() => {
    if (!hoveredNodeId) return null;
    const node = graphNodes.find((n) => n.id === hoveredNodeId);
    return node?.summary || null;
  }, [hoveredNodeId, graphNodes]);

  // Build child map for determining which nodes have children
  const childMap = useMemo(() => {
    const map = new Map<string, string[]>();
    graphNodes.forEach((node) => {
      if (node.parentId && node.parentId !== "root") {
        const children = map.get(node.parentId) || [];
        children.push(node.id);
        map.set(node.parentId, children);
      }
    });
    return map;
  }, [graphNodes]);

  // Get all hidden nodes (descendants of collapsed nodes)
  const hiddenNodes = useMemo(() => {
    const hidden = new Set<string>();

    // For each collapsed node, hide all its descendants
    graphNodes.forEach((node) => {
      if (collapsedNodes.has(node.id)) {
        const descendants = getDescendants(
          node.id,
          graphNodes
            .filter((n) => n.parentId && n.parentId !== "root")
            .map((n) => ({ id: `e-${n.parentId}-${n.id}`, source: n.parentId!, target: n.id }))
        );
        descendants.forEach((d) => hidden.add(d));
      }
    });

    return hidden;
  }, [graphNodes, collapsedNodes]);

  // Convert GraphNode[] to React Flow nodes/edges
  // Supports multiple independent trees (multiple root nodes)
  const { layoutedNodes, layoutedEdges, rootIds, primaryRootId } = useMemo(() => {
    if (graphNodes.length === 0) {
      return { layoutedNodes: [], layoutedEdges: [], rootIds: [], primaryRootId: "" };
    }

    // Find all root nodes (nodes without parents)
    const allRoots = graphNodes.filter((n) => n.parentId === null || n.parentId === "root");
    const rootIdList = allRoots.map(n => n.id);
    
    // Primary root for backwards compatibility (use provided rootNodeId or first root)
    const primaryRoot = rootNodeId || rootIdList[0] || graphNodes[0].id;

    // Filter out hidden nodes
    const visibleNodes = graphNodes.filter((n) => !hiddenNodes.has(n.id));

    // Calculate depth for each node (for each tree)
    const depthMap = new Map<string, number>();
    function calculateDepth(nodeId: string, depth: number) {
      depthMap.set(nodeId, depth);
      const children = childMap.get(nodeId) || [];
      children.forEach(childId => calculateDepth(childId, depth + 1));
    }
    // Calculate depth starting from each root
    rootIdList.forEach(rootId => calculateDepth(rootId, 0));

    const rfNodes: Node[] = visibleNodes.map((node) => ({
      id: node.id,
      type: "concept",
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        isRoot: rootIdList.includes(node.id), // Any root node is marked as root
        hasChildren: (childMap.get(node.id)?.length || 0) > 0,
        childCount: childMap.get(node.id)?.length || 0,
        isCollapsed: collapsedNodes.has(node.id),
        isDirection: node.isDirection,
        isLoading: node.id === loadingNodeId,
        parentId: node.parentId, // Pass parentId for animation
        direction: direction, // Pass direction for floating chevron positioning
        depth: depthMap.get(node.id) || 0, // Pass depth for hierarchy styling
      },
    }));

    const rfEdges: Edge[] = visibleNodes
      .filter((node) => node.parentId && node.parentId !== "root" && !hiddenNodes.has(node.parentId))
      .map((node) => ({
        id: `e-${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: "default",
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      }));

    const layouted = layoutMode === 'tidy'
      ? getTidyTreeLayout(rfNodes, rfEdges, direction)
      : getTreeLayout(rfNodes, rfEdges, direction);
    return { layoutedNodes: layouted.nodes, layoutedEdges: layouted.edges, rootIds: rootIdList, primaryRootId: primaryRoot };
  }, [graphNodes, rootNodeId, hiddenNodes, childMap, collapsedNodes, loadingNodeId, layoutMode, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Track pending camera focus after expand/collapse
  const pendingCameraFocusRef = useRef<{ nodeId: string; isExpanding: boolean } | null>(null);

  // Toggle collapse state for a node
  const toggleCollapse = useCallback((nodeId: string) => {
    const isCurrentlyCollapsed = collapsedNodes.has(nodeId);

    // Store the pending camera focus - will be handled after layout updates
    pendingCameraFocusRef.current = { nodeId, isExpanding: isCurrentlyCollapsed };

    // If COLLAPSING (not currently collapsed, about to collapse)
    if (!isCurrentlyCollapsed) {
      // Get all descendants that will be hidden
      const descendantEdges = graphNodes
        .filter((n) => n.parentId && n.parentId !== "root")
        .map((n) => ({ id: `e-${n.parentId}-${n.id}`, source: n.parentId!, target: n.id }));
      const descendants = getDescendants(nodeId, descendantEdges);
      
      // Close any conversation panels for this node or its descendants
      setNodes(nds => nds.filter(n => {
        if (n.type !== 'conversationPanel') return true;
        // Panel id format is `panel-{nodeId}`
        const panelNodeId = n.id.replace('panel-', '');
        return panelNodeId !== nodeId && !descendants.has(panelNodeId);
      }));
      setEdges(eds => eds.filter(e => {
        if (!e.id.startsWith('panel-edge-')) return true;
        const edgeNodeId = e.id.replace('panel-edge-', '');
        return edgeNodeId !== nodeId && !descendants.has(edgeNodeId);
      }));
      
      // If active node is this node or a descendant, transfer highlight to this node (the parent that's collapsing)
      if (activeNodeId && (activeNodeId === nodeId || descendants.has(activeNodeId))) {
        setActiveNodeId(nodeId);
        // Also notify parent to update global status indicator and other state
        onNodeClick?.(nodeId);
      }
    }

    // Update collapse state (triggers layout recalculation)
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, [collapsedNodes, graphNodes, activeNodeId, setNodes, setEdges, onNodeClick]);

  // Handle camera animation AFTER layout has updated
  useEffect(() => {
    const pending = pendingCameraFocusRef.current;
    if (!pending) return;

    // Clear the pending focus
    pendingCameraFocusRef.current = null;

    // Wait for React Flow to fully process the new layout (100ms is safer than rAF)
    const timeoutId = setTimeout(() => {
      const currentNodes = getNodes();
      const { nodeId, isExpanding } = pending;

      // Find the toggled node in updated layout
      const toggledNode = currentNodes.find(n => n.id === nodeId);
      if (!toggledNode) return;

      if (isExpanding) {
        // EXPANDING: Center on children (the new content)
        const childIds = childMap.get(nodeId) || [];
        const childNodes = currentNodes.filter(n => childIds.includes(n.id));

        if (childNodes.length > 0) {
          // Calculate bounds focusing on CHILDREN as center
          const padding = 60;
          const minX = Math.min(...childNodes.map(n => n.position.x)) - padding;
          const maxX = Math.max(...childNodes.map(n => n.position.x + (getNodeWidth(String(n.data.label || '')) || 200))) + padding;
          const minY = Math.min(...childNodes.map(n => n.position.y)) - padding;
          const maxY = Math.max(...childNodes.map(n => n.position.y + 50)) + padding;

          fitBounds(
            { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
            { duration: 1000, padding: 0.2 }
          );
        }
      } else {
        // COLLAPSING: Center on the collapsed node
        const nodeWidth = getNodeWidth(String(toggledNode.data.label || '')) || 200;
        const padding = 80;

        fitBounds(
          {
            x: toggledNode.position.x - padding,
            y: toggledNode.position.y - padding,
            width: nodeWidth + padding * 2,
            height: 50 + padding * 2
          },
          { duration: 1000, padding: 0.2 }
        );
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [layoutedNodes, getNodes, childMap, fitBounds]); // Triggered when layout changes

  // Compute active path for persistent highlighting (Option C approach)
  // This ensures highlighting persists across all operations
  const { activePathNodeIds, activePathEdgeIds, lastEdgeId } = useMemo(() => {
    if (!activeNodeId) {
      return { activePathNodeIds: new Set<string>(), activePathEdgeIds: new Set<string>(), lastEdgeId: null as string | null };
    }
    const { nodeIds, edgeIds } = findPathToRoot(activeNodeId, layoutedEdges, rootIds);
    // The last edge is the one that connects to the active node (target = activeNodeId)
    const lastEdge = layoutedEdges.find(e => e.target === activeNodeId);
    return { activePathNodeIds: nodeIds, activePathEdgeIds: edgeIds, lastEdgeId: lastEdge?.id || null };
  }, [activeNodeId, layoutedEdges, rootIds]);

  // Effect to apply active path styling immediately when activeNodeId changes
  // This ensures the highlighting persists across all operations
  useEffect(() => {
    if (nodes.length === 0) return;
    
    // Update nodes with active path data
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === 'conversationPanel') return n;
        return {
          ...n,
          data: {
            ...n.data,
            isInActivePath: activePathNodeIds.has(n.id),
            isActiveNode: n.id === activeNodeId,
          },
        };
      })
    );

    // Update edges with active path styling
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id.startsWith('panel-edge-')) return e;
        
        if (activePathEdgeIds.has(e.id)) {
          const isLastEdge = e.id === lastEdgeId;
          return {
            ...e,
            style: { stroke: "#3b82f6", strokeWidth: 3 },
            animated: false,
            zIndex: 1000,
            ...(isLastEdge && {
              markerEnd: {
                type: MarkerType.Arrow,
                color: "#3b82f6",
                width: 15,
                height: 15,
              },
            }),
          };
        }
        return {
          ...e,
          style: { stroke: "#94a3b8", strokeWidth: 2 },
          animated: false,
          zIndex: 0,
          markerEnd: undefined,
        };
      })
    );
  }, [activeNodeId, activePathNodeIds, activePathEdgeIds, lastEdgeId, setNodes, setEdges, nodes.length]);

  // Re-sync when layoutedNodes change - completely replace the nodes/edges arrays
  // We use useLayoutAnimation to handle the transition
  const nodesWithHandlers = useMemo(() => {
    return layoutedNodes.map((node) => {
      const graphNode = graphNodes.find(n => n.id === node.id);
      return {
        ...node,
        // Ensure position is explicitly set
        position: { ...node.position },
        data: {
          ...node.data,
          isExpanded: expandedNodeId === node.id,
          messages: graphNode?.payload || [],
          isInActivePath: activePathNodeIds.has(node.id),
          isActiveNode: node.id === activeNodeId,
          onToggleCollapse: () => toggleCollapse(node.id),
          onDirectionClick: () => onDirectionClick?.(node.id),
          onCloseExpanded: () => setExpandedNodeId(null),
        },
      };
    });
  }, [layoutedNodes, toggleCollapse, onDirectionClick, expandedNodeId, graphNodes, activePathNodeIds, activeNodeId]);

  // Compute edges with active path styling
  const edgesWithActivePath = useMemo(() => {
    return layoutedEdges.map((edge) => {
      if (activePathEdgeIds.has(edge.id)) {
        const isLastEdge = edge.id === lastEdgeId;
        return {
          ...edge,
          style: { stroke: "#3b82f6", strokeWidth: 3 },
          animated: false,
          zIndex: 1000,
          ...(isLastEdge && {
            markerEnd: {
              type: MarkerType.Arrow,
              color: "#3b82f6",
              width: 15,
              height: 15,
            },
          }),
        };
      }
      return edge;
    });
  }, [layoutedEdges, activePathEdgeIds, lastEdgeId]);

  useLayoutAnimation(
    nodesWithHandlers,
    edgesWithActivePath,
    setNodes,
    setEdges,
    useCallback(() => {
      // Only do fitView on initial load (when graph first appears)
      if (!hasInitialFitRef.current && nodesWithHandlers.length > 0) {
        hasInitialFitRef.current = true;
        fitView({ padding: 0.3, duration: 300 });
      }
    }, [fitView, nodesWithHandlers.length])
  );

  // Update nodes/edges when hovering to show path to root (layered on top of active path)
  const handleNodeMouseEnter = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setHoveredNodeId(node.id);
      setTooltipPosition({ x: event.clientX, y: event.clientY });

      const { nodeIds: hoverNodeIds, edgeIds: hoverEdgeIds } = findPathToRoot(node.id, edges, rootIds);
      // Find last edge for hover path (target = hovered node)
      const hoverLastEdge = edges.find(e => e.target === node.id);

      // Update node highlighting (hover takes priority)
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isHighlighted: hoverNodeIds.has(n.id) },
        }))
      );

      // Update edge styling - hover path uses animated dashed style for distinction
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id.startsWith('panel-edge-')) return e;

          const isHoverPath = hoverEdgeIds.has(e.id);
          const isActivePath = activePathEdgeIds.has(e.id);
          const isHoverLastEdge = e.id === hoverLastEdge?.id;
          const isActiveLastEdge = e.id === lastEdgeId;

          if (isHoverPath) {
            return {
              ...e,
              style: { stroke: "#3b82f6", strokeWidth: 5 },
              animated: true,
              zIndex: 1001,
              markerEnd: undefined,
            };
          } else if (isActivePath) {
            // Keep active path visible but dimmed during hover
            return {
              ...e,
              style: { stroke: "#93c5fd", strokeWidth: 3 },
              animated: false,
              zIndex: 1000,
              ...(isActiveLastEdge && {
                markerEnd: {
                  type: MarkerType.Arrow,
                  color: "#93c5fd",
                  width: 15,
                  height: 15,
                },
              }),
            };
          }
          return {
            ...e,
            style: { stroke: "#e2e8f0", strokeWidth: 2 },
            animated: false,
            zIndex: 0,
            markerEnd: undefined,
          };
        })
      );
    },
    [edges, rootIds, activePathEdgeIds, lastEdgeId, setNodes, setEdges]
  );

  // Track mouse movement for tooltip
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (hoveredNodeId) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  }, [hoveredNodeId]);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);

    // Clear hover highlighting - active path highlighting is handled by the memo
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isHighlighted: false },
      }))
    );

    // Restore edge styling based on active path
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id.startsWith('panel-edge-')) return e;

        if (activePathEdgeIds.has(e.id)) {
          const isLastEdge = e.id === lastEdgeId;
          return {
            ...e,
            style: { stroke: "#3b82f6", strokeWidth: 3 },
            animated: false,
            zIndex: 1000,
            ...(isLastEdge && {
              markerEnd: {
                type: MarkerType.Arrow,
                color: "#3b82f6",
                width: 15,
                height: 15,
              },
            }),
          };
        }
        return {
          ...e,
          style: { stroke: "#94a3b8", strokeWidth: 2 },
          animated: false,
          zIndex: 0,
          markerEnd: undefined,
        };
      })
    );
  }, [activePathEdgeIds, lastEdgeId, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);

      // Set this node as the active node for persistent path highlighting
      // The memo will automatically compute and apply the active path styling
      setActiveNodeId(node.id);

      // Find the graph node data to check for messages
      const graphNode = graphNodes.find(n => n.id === node.id);

      // For modal mode: close modal and open new one
      // For panel mode: allow multiple panels (toggle existing panel for same node)
      if (viewMode === 'modal') {
        // Close any existing modal
        setModalData(null);
        // Remove all panels when in modal mode
        setNodes(nds => nds.filter(n => n.type !== 'conversationPanel'));
        setEdges(eds => eds.filter(e => !e.id.startsWith('panel-edge-')));
      }

      if (graphNode?.payload && graphNode.payload.length > 0) {
        // Check view mode - either panel or modal
        if (viewMode === 'modal') {
          // Open center modal with click position for animation origin
          setModalData({
            isOpen: true,
            nodeId: node.id,
            label: graphNode.label,
            messages: graphNode.payload,
            citations: graphNode.citations,
            clickPosition: { x: event.clientX, y: event.clientY },
          });
        } else {
          // Panel mode: Check if panel for this node already exists - toggle it
          const existingPanelId = `panel-${node.id}`;
          const panelExists = getNodes().some(n => n.id === existingPanelId);
          
          if (panelExists) {
            // Toggle off - remove just this panel
            setNodes(nds => nds.filter(n => n.id !== existingPanelId));
            setEdges(eds => eds.filter(e => e.id !== `panel-edge-${node.id}`));
          } else {
            // Create new panel node attached to the graph (allow multiple)
            const nodeWidth = getNodeWidth(graphNode.label);
            const PANEL_GAP = 50; // Gap between node and panel
            const panelId = existingPanelId;

            // Create the panel node positioned to the right of clicked node
            const panelNode: Node = {
              id: panelId,
              type: 'conversationPanel',
              position: {
                x: node.position.x + nodeWidth + PANEL_GAP,
                y: node.position.y - 150, // Offset upward to center
              },
              data: {
                messages: graphNode.payload,
                label: graphNode.label,
                citations: graphNode.citations,
                onClose: () => {
                  // Only remove THIS specific panel node and edge (allow multiple panels)
                  setNodes(nds => nds.filter(n => n.id !== panelId));
                  setEdges(eds => eds.filter(e => e.id !== `panel-edge-${node.id}`));
                },
                onSendMessage: onNodeMessage ? (msg: string) => onNodeMessage(node.id, msg) : undefined,
                isStreaming: isNodeStreaming,
                statusMessage: nodeStatusMessage,
              },
              draggable: false,
              selectable: false,
              zIndex: 9999, // Highest z-index to appear above hover highlighting
            };

            // Create the connecting edge - bezier from source to target
            const panelEdge: Edge = {
              id: `panel-edge-${node.id}`,
              source: node.id,
              target: panelId,
              type: 'default', // bezier curve
              style: { stroke: '#3b82f6', strokeWidth: 3 },
              animated: false,
              zIndex: 9998,
            };

            setNodes(nds => [...nds, panelNode]);
            setEdges(eds => [...eds, panelEdge]);
          }
        }

        // Clear old state (no longer needed)
        setSelectedNodePanel(null);
      } else {
        setSelectedNodePanel(null);
      }
    },
    [onNodeClick, graphNodes, setNodes, setEdges, viewMode, onNodeMessage, isNodeStreaming, nodeStatusMessage, getNodes]
  );

  if (graphNodes.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400">
        No graph data available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full bg-slate-50 relative" onMouseMove={handleMouseMove}>
      {/* Global Status Pill - Top Center */}
      {globalStatus && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <div className={`
            flex items-center px-2 py-2 rounded-full shadow-lg border backdrop-blur-sm
            transition-all duration-300 ease-out overflow-hidden
            ${globalStatus.isActive 
              ? 'bg-blue-50/90 border-blue-200 text-blue-700' 
              : 'bg-white/90 border-slate-200 text-slate-600'}
          `}>
            {globalStatus.isActive ? (
              <TreviLogoAnimation size={32} />
            ) : (
              <TreviLogoStatic size={32} />
            )}
            {globalStatus.isActive ? (
              <div className="flex items-center gap-1.5 px-2">
                <span className="text-sm font-medium whitespace-nowrap">Exploring</span>
                <span className="text-slate-400">—</span>
                <span className="text-sm font-medium">
                  {globalStatus.exploringNodeLabel || globalStatus.activeNodeLabel || 'Knowledge'}
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium px-2">
                {globalStatus.activeNodeLabel || 'Ready'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chat Toggle Button - Top Right (hidden on mobile, we have tab navigation) */}
      {onToggleChatSidebar && (
        <div className="hidden md:block absolute top-4 right-4 z-50 bg-white rounded-lg shadow-md border border-slate-200 p-1">
          <button
            onClick={onToggleChatSidebar}
            className={`p-2 rounded ${isChatSidebarOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Full Conversation"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Control Buttons - Bottom Left - Vertically Stacked Groups */}
      <div className="absolute bottom-4 left-4 z-50 flex flex-col gap-2">
        {/* View Mode Toggle (Panel vs Modal) */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <button
            onClick={() => setViewMode('panel')}
            className={`p-2 rounded ${viewMode === 'panel' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Side Panel View"
          >
            <PanelRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('modal')}
            className={`p-2 rounded ${viewMode === 'modal' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Center Modal View"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>

        {/* Layout Mode Group */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <button
            onClick={() => setLayoutMode('custom')}
            className={`p-2 rounded ${layoutMode === 'custom' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Spacious Layout"
          >
            <GitBranch className="w-5 h-5" />
          </button>
          <button
            onClick={() => setLayoutMode('tidy')}
            className={`p-2 rounded ${layoutMode === 'tidy' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Compact Layout"
          >
            <Layers className="w-5 h-5" />
          </button>
        </div>

        {/* Direction Group */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <button
            onClick={() => setDirection('TB')}
            className={`p-2 rounded ${direction === 'TB' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Top to Bottom"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            onClick={() => setDirection('LR')}
            className={`p-2 rounded ${direction === 'LR' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            title="Left to Right"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Zoom Controls Group */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <button
            onClick={() => zoomIn({ duration: 200 })}
            className="p-2 rounded text-slate-500 hover:bg-slate-50 hover:text-slate-700 active:bg-blue-50 active:text-blue-600"
            title="Zoom In"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => zoomOut({ duration: 200 })}
            className="p-2 rounded text-slate-500 hover:bg-slate-50 hover:text-slate-700 active:bg-blue-50 active:text-blue-600"
            title="Zoom Out"
          >
            <Minus className="w-5 h-5" />
          </button>
          <button
            onClick={() => fitView({ padding: 0.3, duration: 300 })}
            className="p-2 rounded text-slate-500 hover:bg-slate-50 hover:text-slate-700 active:bg-blue-50 active:text-blue-600"
            title="Fit to Screen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.05}
        maxZoom={1.15}
        onMove={(_, vp) => setViewport(vp)}
      >
        <MiniMap
          nodeColor={(node) => {
            // Active node gets bright blue
            if (node.data?.isActiveNode) return "#3b82f6";
            // Nodes in the active path get a lighter blue
            if (node.data?.isInActivePath) return "#93c5fd";
            // Root node gets dark color
            if (node.data?.isRoot) return "#0f172a";
            // Default nodes
            return "#e2e8f0";
          }}
          nodeStrokeColor={(node) => {
            // Active node gets blue stroke
            if (node.data?.isActiveNode) return "#1d4ed8";
            // Path nodes get light blue stroke
            if (node.data?.isInActivePath) return "#3b82f6";
            // Others get subtle stroke
            return "#cbd5e1";
          }}
          nodeStrokeWidth={2}
          maskColor="rgba(0,0,0,0.1)"
        />
        <Background color="#e2e8f0" gap={20} size={1} />
      </ReactFlow>

      {/* Summary Tooltip */}
      {hoveredSummary && (
        <Tooltip content={hoveredSummary} position={tooltipPosition} />
      )}

      {/* Center Modal for conversation (when viewMode is 'modal') */}
      {modalData && modalData.isOpen && (
        <NodeConversationModal
          isOpen={modalData.isOpen}
          messages={modalData.messages}
          nodeLabel={modalData.label}
          citations={modalData.citations}
          onClose={() => setModalData(null)}
          onSendMessage={onNodeMessage ? (msg: string) => onNodeMessage(modalData.nodeId, msg) : undefined}
          isStreaming={isNodeStreaming}
          statusMessage={nodeStatusMessage}
          clickPosition={modalData.clickPosition}
        />
      )}
    </div>
  );
}

// Wrapper component that provides ReactFlowProvider
export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner {...props} />
    </ReactFlowProvider>
  );
}

// ============================================================================
// Utility: Convert API response to GraphNode[]
// ============================================================================

/**
 * Converts CompleteEvent responses into GraphNode array for the graph.
 * Direction nodes are marked with isDirection: true so they can be clicked to explore.
 * Uses a Map to prevent duplicate nodes.
 */
export function buildGraphFromResponses(responses: CompleteEvent[]): GraphNode[] {
  // Use a Map to ensure unique nodes by ID
  const nodeMap = new Map<string, GraphNode>();

  // Track direction node IDs that have been clicked (have a response as child)
  const exploredDirections = new Set<string>();
  responses.forEach((response) => {
    // If this response's parent is not "root", it means a direction was clicked
    if (response.parent_node_id && response.parent_node_id !== "root") {
      exploredDirections.add(response.parent_node_id);
    }
  });

  responses.forEach((response) => {
    // Add main response node (conversation nodes are not clickable directions)
    nodeMap.set(response.node_id, {
      id: response.node_id,
      label: response.label,
      summary: response.summary,
      parentId: response.parent_node_id === "root" ? null : response.parent_node_id,
      isDirection: false,
    });

    // Add direction nodes as children
    response.direction_nodes.forEach((dir) => {
      // Check if this direction has been explored (clicked)
      const hasBeenExplored = exploredDirections.has(dir.node_id);

      // Only add if not already in the map (conversation nodes take precedence)
      if (!nodeMap.has(dir.node_id)) {
        nodeMap.set(dir.node_id, {
          id: dir.node_id,
          label: dir.label,
          summary: dir.summary,
          parentId: response.node_id,
          isDirection: !hasBeenExplored, // Not clickable if already explored
        });
      }
    });
  });

  return Array.from(nodeMap.values());
}
