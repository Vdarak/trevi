"use client";

import React, { useCallback, useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, Layers, ArrowDown, ArrowRight, MessageSquare, X, Plus, Minus, Maximize2, Compass } from 'lucide-react';
import { CompleteEvent, MessagePayload, Citation } from '@/lib/api';
import { hierarchy, tree } from 'd3-hierarchy';
import { NodeConversationPanel } from '@/components/chat/node-conversation-panel';

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
  rootNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  onDirectionClick?: (nodeId: string) => void; // Callback for clicking direction nodes
  loadingNodeId?: string | null; // Node ID currently being loaded
  onToggleChatSidebar?: () => void; // Toggle full conversation sidebar
  isChatSidebarOpen?: boolean; // Whether the chat sidebar is open
  initialActiveNodeId?: string | null; // Active node to highlight on initial load
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

  // Find root node (no parent)
  const rootId = nodes.find((n) => !parentMap.has(n.id))?.id;
  if (!rootId) return { nodes, edges };

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

  calculateSubtreeBreadth(rootId);

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

  const totalBreadth = subtreeBreadths.get(rootId) || 180;
  // Start centered
  if (isLR) {
    positionNode(rootId, 0, -totalBreadth / 2);
  } else {
    positionNode(rootId, -totalBreadth / 2, 0);
  }

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
 */
function getTidyTreeLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const isLR = direction === 'LR';

  // Build parent-child relationships to find root and build hierarchy
  const childMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();

  edges.forEach((edge) => {
    parentMap.set(edge.target, edge.source);
    const children = childMap.get(edge.source) || [];
    children.push(edge.target);
    childMap.set(edge.source, children);
  });

  // Find root node
  const rootId = nodes.find((n) => !parentMap.has(n.id))?.id;
  if (!rootId) return { nodes, edges };

  const rootNode = nodes.find(n => n.id === rootId);
  if (!rootNode) return { nodes, edges };

  // Create D3 hierarchy
  const d3Root = hierarchy(rootNode, (d) => {
    const childrenIds = childMap.get(d.id);
    return childrenIds?.map(id => nodes.find(n => n.id === id)!) || null;
  });

  // Configure tree layout
  const treeLayout = tree<Node>();

  if (isLR) {
    // LR Layout
    // nodeSize([height, width]) - height is vertical spacing (breadth), width is horizontal (depth)
    // But D3 tree uses x for breadth and y for depth usually.
    // We will map d3.x -> screen.y (breadth) and d3.y -> screen.x (depth)

    // Calculate max width per depth level to ensure alignment
    const depthWidths = new Map<number, number>();
    d3Root.each((node) => {
      const width = getNodeWidth(node.data.data.label as string);
      const currentMax = depthWidths.get(node.depth) || 0;
      depthWidths.set(node.depth, Math.max(currentMax, width));
    });

    treeLayout
      .nodeSize([NODE_HEIGHT, 1]) // 1 is dummy depth, we'll fix it manually
      .separation((a, b) => {
        // Vertical separation
        return (a.parent === b.parent ? SIBLING_SEP : SUBTREE_SEP) / NODE_HEIGHT + 1;
      });

    treeLayout(d3Root);

    // Fix X coordinates (depth) based on max widths
    d3Root.each((node) => {
      let x = 0;
      for (let i = 0; i < node.depth; i++) {
        x += (depthWidths.get(i) || 180) + RANK_SEP;
      }
      // d3.y is depth, but we overwrite it
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

  // Map positions back to nodes
  const layoutedNodes = nodes.map((node) => {
    const d3Node = d3Root.descendants().find((d) => d.data.id === node.id);

    if (d3Node) {
      return {
        ...node,
        targetPosition: isLR ? Position.Left : Position.Top,
        sourcePosition: isLR ? Position.Right : Position.Bottom,
        position: isLR
          ? { x: d3Node.y ?? 0, y: d3Node.x ?? 0 } // Swap for LR: d3.y is depth(x), d3.x is breadth(y)
          : { x: d3Node.x ?? 0, y: d3Node.y ?? 0 },
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
 * Finds the path from a node to the root by traversing edges backwards.
 */
function findPathToRoot(
  nodeId: string,
  edges: Edge[],
  rootId: string
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>([nodeId]);
  const edgeIds = new Set<string>();

  // Build parent map from edges
  const parentMap = new Map<string, { parentId: string; edgeId: string }>();
  edges.forEach((edge) => {
    parentMap.set(edge.target, { parentId: edge.source, edgeId: edge.id });
  });

  // Traverse up to root
  let currentId = nodeId;
  while (currentId !== rootId && parentMap.has(currentId)) {
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

// Citation tooltip component - dialog-style with scrollable content
function CitationTooltipGraph({
  index,
  content,
  title = 'Source'
}: {
  index: string;
  content: string;
  title?: string;
}) {
  return (
    <span className="inline-flex items-baseline relative group cursor-pointer">
      <sup className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[9px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors leading-none">
        {index}
      </sup>
      {/* Dialog-style tooltip with scrollable content and footer */}
      <div
        className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        style={{ zIndex: 99999 }}
      >
        {/* Scrollable content area */}
        <div className="max-h-40 overflow-y-auto px-3 py-2.5 text-[10px] text-slate-700 leading-relaxed">
          {content}
        </div>
        {/* Footer with source indicator */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-[10px] text-slate-500 truncate font-medium">
            {title}
          </span>
        </div>
      </div>
    </span>
  );
}




// Simple markdown renderer for conversation messages with citation support
function renderSimpleMarkdown(text: string, citationsData?: Citation[]): React.ReactNode {
  // FIRST: Protect markdown links by replacing them with placeholders
  const links: { text: string; url: string }[] = [];
  let processedText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    links.push({ text: linkText, url });
    return `__LINK_${links.length - 1}__`;
  });

  // SECOND: Extract citations [index: title] - must have colon
  const extractedCitations: { index: string; title: string }[] = [];
  processedText = processedText.replace(/\[(\d+):\s*([^\]]+)\]/g, (match, index, title) => {
    extractedCitations.push({ index, title: title.trim() });
    return `__CITATION_${extractedCitations.length - 1}__`;
  });

  // THIRD: Handle standalone reference numbers [n]
  processedText = processedText.replace(/\[(\d+)\]/g, '<sup class="text-blue-600 font-medium text-[9px]">[$1]</sup>');

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

        elements.push(
          <CitationTooltipGraph
            key={`cite-${i}`}
            index={citation.index}
            content={tooltipContent}
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
          relative ${sizeClass} ${borderClass} ${radiusClass} ${shadowClass} transition-all duration-200 flex items-center gap-3 whitespace-nowrap
          ${data.isRoot
            ? "bg-slate-900 text-white border-slate-900"
            : data.isLoading
              ? "bg-blue-50 border-blue-300"
              : isClickableDirection
                ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 cursor-pointer hover:shadow-md"
                : data.isHighlighted
                  ? "bg-blue-50 border-blue-400 shadow-md"
                  : isParentNode
                    ? `bg-slate-50 border-slate-300 hover:border-slate-400`
                    : "bg-white border-slate-200 hover:border-slate-300"
          }
        `}
        onClick={(e) => {
          if (isClickableDirection && data.onDirectionClick && !data.isLoading) {
            e.stopPropagation();
            data.onDirectionClick();
          }
        }}
      >
        {/* Target Handle - always on the node */}
        <Handle type="target" position={targetPosition || Position.Top} className="!bg-slate-400" />

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
}

function ConversationPanelNode({ data }: { data: ConversationPanelNodeData }) {
  return (
    <div
      className="w-[380px] h-[500px] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl flex flex-col animate-scale-in relative"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.95) 100%)',
      }}
    >
      {/* Target Handle on left center - solid dot matching node styling */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-400 !w-3 !h-3 !border-0 !rounded-full"
        style={{ left: -6 }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/50 flex-shrink-0">
        <h3 className="font-medium text-slate-800 text-sm truncate max-w-[300px]">
          {data.label || 'Conversation'}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onClose();
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages - visible scrollbar */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
      >
        {data.messages.map((msg, index) => (
          <div
            key={index}
            className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}
          >
            <div
              className={`inline-block max-w-[95%] px-3 py-2 rounded-xl ${msg.role === 'user'
                ? 'bg-slate-800 text-white rounded-br-md'
                : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}
            >
              <div className="text-xs leading-relaxed break-words whitespace-pre-wrap">
                {renderSimpleMarkdown(msg.content, data.citations)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Type assertion for nodeTypes to work with React Flow
const nodeTypes = {
  concept: ConceptNode,
  conversationPanel: ConversationPanelNode,
} as const;

// ============================================================================
// Tooltip Component
// ============================================================================

interface TooltipProps {
  content: string;
  position: { x: number; y: number };
}

function Tooltip({ content, position }: TooltipProps) {
  return (
    <div
      className="fixed z-[9999] max-w-xs px-4 py-1 bg-slate-800 text-white text-xs rounded shadow-lg pointer-events-none -translate-x-1/2"
      style={{
        left: position.x,
        top: position.y + 20,
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

    // Identify exiting nodes (present in current but not in target)
    const targetNodeIds = new Set(targetNodes.map(n => n.id));
    currentNodes.forEach(node => {
      if (!targetNodeIds.has(node.id)) {
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

      setNodes([...nextTargetNodes, ...nextExitingNodes]);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = null;
        // Final state: only target nodes
        setNodes(targetNodes);
        onAnimationComplete?.();
      }
    };

    // Cancel previous animation
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    startTimeRef.current = null;
    animationFrameRef.current = requestAnimationFrame(animate);

    // Update edges immediately - they will follow the nodes as they move
    setEdges(targetEdges);

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
function KnowledgeGraphInner({ nodes: graphNodes, rootNodeId, onNodeClick, onDirectionClick, loadingNodeId, onToggleChatSidebar, isChatSidebarOpen, initialActiveNodeId }: KnowledgeGraphProps) {
  const { fitView, fitBounds, getViewport, zoomIn, zoomOut, getNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<'custom' | 'tidy'>('custom');
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(initialActiveNodeId || null); // Track clicked/active node for persistent path highlighting

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
  const { layoutedNodes, layoutedEdges, rootId } = useMemo(() => {
    if (graphNodes.length === 0) {
      return { layoutedNodes: [], layoutedEdges: [], rootId: "" };
    }

    const root = rootNodeId || graphNodes.find((n) => n.parentId === null || n.parentId === "root")?.id || graphNodes[0].id;

    // Filter out hidden nodes
    const visibleNodes = graphNodes.filter((n) => !hiddenNodes.has(n.id));

    // Calculate depth for each node
    const depthMap = new Map<string, number>();
    function calculateDepth(nodeId: string, depth: number) {
      depthMap.set(nodeId, depth);
      const children = childMap.get(nodeId) || [];
      children.forEach(childId => calculateDepth(childId, depth + 1));
    }
    calculateDepth(root, 0);

    const rfNodes: Node[] = visibleNodes.map((node) => ({
      id: node.id,
      type: "concept",
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        isRoot: node.id === root,
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
    return { layoutedNodes: layouted.nodes, layoutedEdges: layouted.edges, rootId: root };
  }, [graphNodes, rootNodeId, hiddenNodes, childMap, collapsedNodes, loadingNodeId, layoutMode, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Toggle collapse state for a node with synchronized camera animation
  const toggleCollapse = useCallback((nodeId: string) => {
    const isCurrentlyCollapsed = collapsedNodes.has(nodeId);
    const currentNodes = getNodes();

    // Find the node being toggled and its parent
    const toggledNode = currentNodes.find(n => n.id === nodeId);
    const parentNode = toggledNode?.data?.parentId
      ? currentNodes.find(n => n.id === toggledNode.data.parentId)
      : null;

    // Calculate which nodes to fit in view
    let nodesToFit: typeof currentNodes = [];

    if (isCurrentlyCollapsed) {
      // Expanding: fit parent + the node + its children that will become visible
      const childIds = childMap.get(nodeId) || [];
      nodesToFit = currentNodes.filter(n =>
        n.id === nodeId ||
        (parentNode && n.id === parentNode.id) ||
        childIds.includes(n.id)
      );
    } else {
      // Collapsing: fit parent + the node being collapsed
      nodesToFit = currentNodes.filter(n =>
        n.id === nodeId ||
        (parentNode && n.id === parentNode.id)
      );
    }

    // Update collapse state
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });

    // Animate camera to focus on relevant nodes (with matching duration)
    if (nodesToFit.length > 0) {
      // Calculate bounds of nodes to fit
      const padding = 100;
      const minX = Math.min(...nodesToFit.map(n => n.position.x)) - padding;
      const maxX = Math.max(...nodesToFit.map(n => n.position.x + (getNodeWidth(String(n.data.label || '')) || 200))) + padding;
      const minY = Math.min(...nodesToFit.map(n => n.position.y)) - padding;
      const maxY = Math.max(...nodesToFit.map(n => n.position.y + 50)) + padding;

      // Animate to bounds with same duration as node animation (1200ms)
      fitBounds(
        { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        { duration: 1200, padding: 0.2 }
      );
    }
  }, [collapsedNodes, getNodes, childMap, fitBounds]);

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
          onToggleCollapse: () => toggleCollapse(node.id),
          onDirectionClick: () => onDirectionClick?.(node.id),
          onCloseExpanded: () => setExpandedNodeId(null),
        },
      };
    });
  }, [layoutedNodes, toggleCollapse, onDirectionClick, expandedNodeId, graphNodes]);

  useLayoutAnimation(
    nodesWithHandlers,
    layoutedEdges,
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

      const { nodeIds: hoverNodeIds, edgeIds: hoverEdgeIds } = findPathToRoot(node.id, edges, rootId);

      // Get active path if exists
      const activePath = activeNodeId ? findPathToRoot(activeNodeId, edges, rootId) : { nodeIds: new Set<string>(), edgeIds: new Set<string>() };

      // Update node highlighting (hover takes priority, but active also highlighted)
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isHighlighted: hoverNodeIds.has(n.id) || activePath.nodeIds.has(n.id) },
        }))
      );

      // Update edge styling - hover path thickest, active path thick, others normal
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id.startsWith('panel-edge-')) return e;

          const isHoverPath = hoverEdgeIds.has(e.id);
          const isActivePath = activePath.edgeIds.has(e.id);

          if (isHoverPath) {
            return {
              ...e,
              style: { stroke: "#3b82f6", strokeWidth: 5 },
              animated: true,
              zIndex: 1001,
            };
          } else if (isActivePath) {
            return {
              ...e,
              style: { stroke: "#3b82f6", strokeWidth: 5 },
              animated: true,
              zIndex: 1000,
            };
          }
          return {
            ...e,
            style: { stroke: "#e2e8f0", strokeWidth: 2 },
            animated: false,
            zIndex: 0,
          };
        })
      );
    },
    [edges, rootId, activeNodeId, setNodes, setEdges]
  );

  // Track mouse movement for tooltip
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (hoveredNodeId) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  }, [hoveredNodeId]);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);

    // If there's an active node, revert to showing active path; otherwise clear all
    if (activeNodeId) {
      const { nodeIds, edgeIds } = findPathToRoot(activeNodeId, edges, rootId);

      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isHighlighted: nodeIds.has(n.id) },
        }))
      );

      setEdges((eds) =>
        eds.map((e) => {
          if (e.id.startsWith('panel-edge-')) return e;

          if (edgeIds.has(e.id)) {
            return {
              ...e,
              style: { stroke: "#3b82f6", strokeWidth: 5 },
              animated: true,
              zIndex: 1000,
            };
          }
          return {
            ...e,
            style: { stroke: "#94a3b8", strokeWidth: 2 },
            animated: false,
            zIndex: 0,
          };
        })
      );
    } else {
      // No active node, clear all highlighting
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isHighlighted: false },
        }))
      );

      setEdges((eds) =>
        eds.map((e) => {
          if (e.id.startsWith('panel-edge-')) return e;
          return {
            ...e,
            style: { stroke: "#94a3b8", strokeWidth: 2 },
            animated: false,
            zIndex: 0,
          };
        })
      );
    }
  }, [activeNodeId, edges, rootId, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);

      // Set this node as the active node for persistent path highlighting
      setActiveNodeId(node.id);

      // Find the graph node data to check for messages
      const graphNode = graphNodes.find(n => n.id === node.id);

      // First, remove any existing panel node and its edge
      setNodes(nds => nds.filter(n => n.type !== 'conversationPanel'));
      setEdges(eds => eds.filter(e => !e.id.startsWith('panel-edge-')));

      // Apply active path highlighting immediately
      const { nodeIds, edgeIds } = findPathToRoot(node.id, edges, rootId);

      setNodes((nds) =>
        nds.filter(n => n.type !== 'conversationPanel').map((n) => ({
          ...n,
          data: { ...n.data, isHighlighted: nodeIds.has(n.id) },
        }))
      );

      setEdges((eds) =>
        eds.filter(e => !e.id.startsWith('panel-edge-')).map((e) => {
          if (edgeIds.has(e.id)) {
            return {
              ...e,
              style: { stroke: "#60a5fa", strokeWidth: 3 },
              animated: true,
              zIndex: 1000,
            };
          }
          return {
            ...e,
            style: { stroke: "#94a3b8", strokeWidth: 2 },
            animated: false,
            zIndex: 0,
          };
        })
      );

      if (graphNode?.payload && graphNode.payload.length > 0) {
        const nodeWidth = getNodeWidth(graphNode.label);
        const PANEL_GAP = 50; // Gap between node and panel

        // Create the panel node positioned to the right of clicked node
        const panelNode: Node = {
          id: `panel-${node.id}`,
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
              // Keep activeNodeId - path highlighting should persist for context
              // Only remove the panel node and edge
              setNodes(nds => nds.filter(n => n.type !== 'conversationPanel'));
              setEdges(eds => eds.filter(e => !e.id.startsWith('panel-edge-')));

              // Clear hovered state
              setHoveredNodeId(null);
            },
          },
          draggable: false,
          selectable: false,
          zIndex: 9999, // Highest z-index to appear above hover highlighting
        };

        // Create the connecting edge - bezier from source to target
        const panelEdge: Edge = {
          id: `panel-edge-${node.id}`,
          source: node.id,
          target: `panel-${node.id}`,
          type: 'default', // bezier curve
          style: { stroke: '#3b82f6', strokeWidth: 3 },
          animated: false,
          zIndex: 9998,
        };

        setNodes(nds => [...nds, panelNode]);
        setEdges(eds => [...eds, panelEdge]);

        // Clear old state (no longer needed)
        setSelectedNodePanel(null);
      } else {
        setSelectedNodePanel(null);
      }
    },
    [onNodeClick, graphNodes, edges, rootId, setNodes, setEdges]
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
      {/* Chat Toggle Button - Top Right */}
      {onToggleChatSidebar && (
        <div className="absolute top-4 right-4 z-50 bg-white rounded-lg shadow-md border border-slate-200 p-1">
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
          nodeColor={(node) => node.data?.isRoot ? "#0f172a" : "#e2e8f0"}
          maskColor="rgba(0,0,0,0.1)"
        />
        <Background color="#e2e8f0" gap={20} size={1} />
      </ReactFlow>

      {/* Summary Tooltip */}
      {hoveredSummary && (
        <Tooltip content={hoveredSummary} position={tooltipPosition} />
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
