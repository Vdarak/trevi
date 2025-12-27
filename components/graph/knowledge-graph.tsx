"use client";

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CompleteEvent } from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

export interface GraphNode {
  id: string;
  label: string;
  summary?: string;
  parentId: string | null;
}

export interface KnowledgeGraphProps {
  nodes: GraphNode[];
  rootNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
}

// ============================================================================
// Layout Configuration
// ============================================================================

const NODE_WIDTH = 200;
const NODE_HEIGHT = 50;
const NODE_SEP = 80;  // Horizontal spacing between siblings
const RANK_SEP = 100; // Vertical spacing between levels

/**
 * Auto-layouts nodes using dagre algorithm.
 * Ensures nodes at same depth are aligned and centered over children.
 */
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const isHorizontal = direction === "LR";
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
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
  onToggleCollapse?: () => void;
  [key: string]: unknown;
}

function ConceptNode({ data }: { data: ConceptNodeData }) {
  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 shadow-sm transition-all duration-200 flex items-center justify-center gap-2
        ${data.isRoot 
          ? "bg-slate-900 text-white border-slate-900" 
          : data.isHighlighted
            ? "bg-blue-50 border-blue-400 shadow-md"
            : "bg-white border-slate-200 hover:border-slate-300"
        }
      `}
      style={{ minWidth: NODE_WIDTH - 20, maxWidth: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      
      {/* Collapse/Expand button */}
      {data.hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleCollapse?.();
          }}
          className={`
            flex-shrink-0 w-5 h-5 rounded flex items-center justify-center
            ${data.isRoot ? "hover:bg-slate-700" : "hover:bg-slate-100"}
          `}
        >
          {data.isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      )}
      
      <div className={`font-medium text-sm truncate text-center ${data.isRoot ? "text-white" : "text-slate-800"}`}>
        {data.label}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
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
// Main Component
// ============================================================================

export function KnowledgeGraph({ nodes: graphNodes, rootNodeId, onNodeClick }: KnowledgeGraphProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

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
        isCollapsed: collapsedNodes.has(node.id),
      },
    }));

    const rfEdges: Edge[] = visibleNodes
      .filter((node) => node.parentId && node.parentId !== "root" && !hiddenNodes.has(node.parentId))
      .map((node) => ({
        id: `e-${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      }));

    const layouted = getLayoutedElements(rfNodes, rfEdges, "TB");
    return { layoutedNodes: layouted.nodes, layoutedEdges: layouted.edges, rootId: root };
  }, [graphNodes, rootNodeId, hiddenNodes, childMap, collapsedNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

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

  // Re-sync when layoutedNodes change
  useEffect(() => {
    // Add collapse toggle handler to node data
    const nodesWithHandlers = layoutedNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onToggleCollapse: () => toggleCollapse(node.id),
      },
    }));
    setNodes(nodesWithHandlers);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges, toggleCollapse]);

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

      // Update edge styling - dotted line for path to root with higher z-index
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: edgeIds.has(e.id)
            ? { stroke: "#3b82f6", strokeWidth: 3, strokeDasharray: "5,5" }
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
        fitView
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

// ============================================================================
// Utility: Convert API response to GraphNode[]
// ============================================================================

/**
 * Converts CompleteEvent responses into GraphNode array for the graph.
 */
export function buildGraphFromResponses(responses: CompleteEvent[]): GraphNode[] {
  const nodes: GraphNode[] = [];

  responses.forEach((response) => {
    // Add main response node
    nodes.push({
      id: response.node_id,
      label: response.label,
      summary: response.summary,
      parentId: response.parent_node_id === "root" ? null : response.parent_node_id,
    });

    // Add direction nodes as children
    response.direction_nodes.forEach((dir) => {
      nodes.push({
        id: dir.node_id,
        label: dir.label,
        summary: dir.summary,
        parentId: response.node_id,
      });
    });
  });

  return nodes;
}
