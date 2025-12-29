"use client";

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
import { ChevronDown, ChevronRight, LayoutGrid, Network, ArrowDown, ArrowRight } from 'lucide-react';
import { CompleteEvent } from '@/lib/api';
import { hierarchy, tree } from 'd3-hierarchy';

// ============================================================================
// Types
// ============================================================================

export interface GraphNode {
  id: string;
  label: string;
  summary?: string;
  parentId: string | null;
  isDirection?: boolean; // True if this is a direction node (clickable to explore)
}

export interface KnowledgeGraphProps {
  nodes: GraphNode[];
  rootNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  onDirectionClick?: (nodeId: string) => void; // Callback for clicking direction nodes
  loadingNodeId?: string | null; // Node ID currently being loaded
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
          ? { x: d3Node.y, y: d3Node.x } // Swap for LR: d3.y is depth(x), d3.x is breadth(y)
          : { x: d3Node.x, y: d3Node.y },
      };
    }
    return node;
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
  onToggleCollapse?: () => void;
  onDirectionClick?: () => void;
  [key: string]: unknown;
}

function ConceptNode({ data, targetPosition, sourcePosition }: { data: ConceptNodeData, targetPosition?: Position, sourcePosition?: Position }) {
  const isClickableDirection = data.isDirection && !data.hasChildren;
  const showCollapsedDots = data.isCollapsed && data.hasChildren && (data.childCount ?? 0) > 0;
  
  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          relative px-4 py-2 rounded-lg border-2 shadow-sm transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap
          ${data.isRoot 
            ? "bg-slate-900 text-white border-slate-900" 
            : data.isLoading
              ? "bg-blue-50 border-blue-300"
              : isClickableDirection
                ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400 cursor-pointer hover:shadow-md"
                : data.isHighlighted
                  ? "bg-blue-50 border-blue-400 shadow-md"
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
        <Handle type="target" position={targetPosition || Position.Top} className="!bg-slate-400" />
        
        {/* Collapse/Expand button */}
        {data.hasChildren && !data.isLoading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleCollapse?.();
            }}
            className={`
              relative z-10 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center
              ${data.isRoot ? "hover:bg-slate-700 text-white" : "hover:bg-slate-100 text-slate-700"}
            `}
          >
            {data.isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
        
        {/* Loading spinner */}
        {data.isLoading && (
          <div className="flex-shrink-0 w-4 h-4">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        <div className={`font-medium text-sm text-center ${data.isRoot ? "text-white" : data.isLoading ? "text-blue-600" : "text-slate-800"}`}>
          {data.label}
        </div>
        
        {/* Direction indicator */}
        {isClickableDirection && !data.isLoading && (
          <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
            <ChevronRight className="w-3 h-3 text-blue-600" />
          </div>
        )}
        
        <Handle type="source" position={sourcePosition || Position.Bottom} className="!bg-slate-400" />
      </div>
      
      {/* Collapsed children indicator dots */}
      {showCollapsedDots && (
        <div className="flex items-center gap-1 mt-2 px-2 py-1 bg-slate-100 rounded-full">
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

// Type assertion for nodeTypes to work with React Flow
const nodeTypes = { concept: ConceptNode } as const;

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
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>();
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
    const exitNodeMap = new Map<string, { start: Node, targetPos: {x: number, y: number} }>();
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
    const duration = 900; // ms
    
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
                pointerEvents: 'none', // Disable interaction while exiting
            }
        };
      });
      
      setNodes([...nextTargetNodes, ...nextExitingNodes]);
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = undefined;
        // Final state: only target nodes
        setNodes(targetNodes);
        onAnimationComplete?.();
      }
    };
    
    // Cancel previous animation
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    startTimeRef.current = undefined;
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
function KnowledgeGraphInner({ nodes: graphNodes, rootNodeId, onNodeClick, onDirectionClick, loadingNodeId }: KnowledgeGraphProps) {
  const { fitView } = useReactFlow();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<'custom' | 'tidy'>('custom');
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  
  // Track if we've done the initial fitView
  const hasInitialFitRef = useRef(false);

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

  // Toggle collapse state for a node
  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Re-sync when layoutedNodes change - completely replace the nodes/edges arrays
  // We use useLayoutAnimation to handle the transition
  const nodesWithHandlers = useMemo(() => {
    return layoutedNodes.map((node) => ({
      ...node,
      // Ensure position is explicitly set
      position: { ...node.position },
      data: {
        ...node.data,
        onToggleCollapse: () => toggleCollapse(node.id),
        onDirectionClick: () => onDirectionClick?.(node.id),
      },
    }));
  }, [layoutedNodes, toggleCollapse, onDirectionClick]);

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

  // Update nodes/edges when hovering to show path to root
  const handleNodeMouseEnter = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setHoveredNodeId(node.id);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
      
      const { nodeIds, edgeIds } = findPathToRoot(node.id, edges, rootId);

      // Update node highlighting
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isHighlighted: nodeIds.has(n.id) },
        }))
      );

      // Update edge styling - highlight path to root
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: edgeIds.has(e.id)
            ? { stroke: "#3b82f6", strokeWidth: 3 }
            : { stroke: "#e2e8f0", strokeWidth: 2 },
          animated: edgeIds.has(e.id),
          zIndex: edgeIds.has(e.id) ? 1000 : 0,
        }))
      );
    },
    [edges, rootId, setNodes, setEdges]
  );

  // Track mouse movement for tooltip
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (hoveredNodeId) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  }, [hoveredNodeId]);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);

    // Reset node highlighting
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isHighlighted: false },
      }))
    );

    // Reset edge styling
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: { stroke: "#94a3b8", strokeWidth: 2 },
        animated: false,
        zIndex: 0,
      }))
    );
  }, [setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  if (graphNodes.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400">
        No graph data available
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-50 relative" onMouseMove={handleMouseMove}>
      {/* Layout Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
        {/* Layout Mode Toggle */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex gap-1">
          <button
            onClick={() => setLayoutMode('custom')}
            className={`p-2 rounded ${layoutMode === 'custom' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Custom Layout"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setLayoutMode('tidy')}
            className={`p-2 rounded ${layoutMode === 'tidy' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Tidy Tree Layout"
          >
            <Network className="w-5 h-5" />
          </button>
        </div>

        {/* Direction Toggle */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex gap-1">
          <button
            onClick={() => setDirection('TB')}
            className={`p-2 rounded ${direction === 'TB' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Top to Bottom"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            onClick={() => setDirection('LR')}
            className={`p-2 rounded ${direction === 'LR' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Left to Right"
          >
            <ArrowRight className="w-5 h-5" />
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
        minZoom={0.3}
        maxZoom={2}
      >
        <Controls 
          showInteractive={false}
          className="!bg-white !border-slate-200 !shadow-md [&>button]:!bg-white [&>button]:!border-slate-200 [&>button]:!text-slate-700 [&>button:hover]:!bg-slate-100"
        />
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
