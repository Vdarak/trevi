"use client";

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, Layers, ArrowDown, ArrowRight, Plus, Minus, Maximize2, PanelRight, Maximize, MessageSquare } from 'lucide-react';
import { MessagePayload, Citation } from '@/lib/api';
import { TreviLogoAnimation, TreviLogoStatic } from '@/components/ui/trevi-logo';
import { NodeConversationPanel, NodeConversationModal } from '@/components/chat/node-conversation-panel';

// Import from modular components
import type { GraphNode, KnowledgeGraphProps, ConceptNodeData, ConversationPanelNodeData } from './types';
import {
  getTreeLayout,
  getTidyTreeLayout,
  getNodeWidth,
  findPathToRoot,
  getDescendants,
  useLayoutAnimation,
} from './graph-layout';
import { ConceptNode } from './nodes/concept-node';
import { ConversationPanelNode } from './nodes/conversation-panel-node';
import { DeletableEdge, type DeletableEdgeData } from './edges/deletable-edge';
import { Tooltip } from './ui/tooltip';
import { ToolbarButton } from './ui/toolbar-button';
import { StatusPill } from './ui/status-pill';
import { QuickFeedback, FeedbackNudgeTooltip, TreviDisclaimer } from '@/components/feedback/quick-feedback';

// Re-export types for external use
export type { GraphNode, KnowledgeGraphProps } from './types';

// Re-export buildGraphFromResponses from utils
export { buildGraphFromResponses } from './utils/graph-builder';

// Node type registration for React Flow
const nodeTypes = {
  concept: ConceptNode,
  conversationPanel: ConversationPanelNode,
} as const;

// Edge type registration for React Flow
const edgeTypes = {
  deletable: DeletableEdge,
} as const;

// ============================================================================
// Main Component
// ============================================================================

// Inner component that has access to useReactFlow
function KnowledgeGraphInner({ nodes: graphNodes, rootNodeId, onNodeClick, onDirectionClick, onDeleteNode, loadingNodeIds, onToggleChatSidebar, isChatSidebarOpen, initialActiveNodeId, onNodeMessage, isNodeStreaming, nodeStatusMessage, nodeStreamUserMessage, globalStatus, chatId, briefCache, onBriefCacheUpdate }: KnowledgeGraphProps) {
  const { fitView, fitBounds, getViewport, zoomIn, zoomOut, getNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<'custom' | 'tidy'>('tidy');
  const [direction, setDirection] = useState<'TB' | 'LR'>('LR');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(initialActiveNodeId || null); // Track clicked/active node for persistent path highlighting
  const [viewMode, setViewMode] = useState<'panel' | 'modal'>('modal'); // Toggle between panel and modal view
  const [isStatusPillExpanded, setIsStatusPillExpanded] = useState(false); // Toggle for status pill dropdown
  const [statusPillWarning, setStatusPillWarning] = useState<string | undefined>(undefined); // Temporary warning message for status pill

  // Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    nodeId: string;
    nodeLabel: string;
    status: 'confirm' | 'deleting' | 'success';
  } | null>(null);

  // Periodic feedback prompt state
  const [showPeriodicFeedback, setShowPeriodicFeedback] = useState(false);
  const periodicFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFeedbackDismissRef = useRef<number>(0);

  // Start periodic feedback timer when graph has nodes
  useEffect(() => {
    // Only start timer if we have nodes and haven't shown feedback recently
    if (graphNodes.length > 0 && !showPeriodicFeedback) {
      // Clear any existing timer
      if (periodicFeedbackTimerRef.current) {
        clearTimeout(periodicFeedbackTimerRef.current);
      }

      // Check if 5 minutes have passed since last dismiss
      const timeSinceLastDismiss = Date.now() - lastFeedbackDismissRef.current;
      const fiveMinutes = 5 * 60 * 1000;

      // Set timer for 5 minutes (or remaining time if recently dismissed)
      const timeToWait = Math.max(fiveMinutes - timeSinceLastDismiss, fiveMinutes);

      periodicFeedbackTimerRef.current = setTimeout(() => {
        setShowPeriodicFeedback(true);
      }, timeToWait);
    }

    return () => {
      if (periodicFeedbackTimerRef.current) {
        clearTimeout(periodicFeedbackTimerRef.current);
      }
    };
  }, [graphNodes.length, showPeriodicFeedback]);

  const handleDismissPeriodicFeedback = useCallback(() => {
    setShowPeriodicFeedback(false);
    lastFeedbackDismissRef.current = Date.now();
  }, []);

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

  // Reset state when rootNodeId changes (new/different chat loaded)
  // Keep nodes expanded - only reset the initial fit flag
  useEffect(() => {
    if (rootNodeId !== prevRootNodeIdRef.current) {
      hasInitialFitRef.current = false;
      prevRootNodeIdRef.current = rootNodeId;

      // Clear collapsed nodes so everything is expanded when loading a chat
      setCollapsedNodes(new Set());
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
    // Normalize loadingNodeIds to a Set for consistent checking
    const loadingSet = loadingNodeIds instanceof Set
      ? loadingNodeIds
      : new Set(loadingNodeIds || []);
    const isLoading = loadingSet.size > 0;
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
  }, [loadingNodeIds, graphNodes.length, fitView]);

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
        isLoading: loadingNodeIds instanceof Set
          ? loadingNodeIds.has(node.id)
          : (loadingNodeIds || []).includes(node.id),
        parentId: node.parentId, // Pass parentId for animation
        direction: direction, // Pass direction for floating chevron positioning
        depth: depthMap.get(node.id) || 0, // Pass depth for hierarchy styling
      },
    }));

    // Check if any node is currently being explored/loaded
    const isAnyNodeLoading = loadingNodeIds instanceof Set
      ? loadingNodeIds.size > 0
      : (loadingNodeIds || []).length > 0;

    const rfEdges: Edge[] = visibleNodes
      .filter((node) => node.parentId && node.parentId !== "root" && !hiddenNodes.has(node.parentId))
      .map((node) => {
        // Check if this node or any of its descendants is being loaded
        const nodeIsLoading = loadingNodeIds instanceof Set
          ? loadingNodeIds.has(node.id)
          : (loadingNodeIds || []).includes(node.id);

        // Cannot delete if:
        // 1. The target node is being loaded
        // 2. Any node in the graph is being explored (globalStatus)
        // 3. This is a root node (has no parent - handled by filter above)
        const canDelete = !nodeIsLoading && !isAnyNodeLoading;

        return {
          id: `e-${node.parentId}-${node.id}`,
          source: node.parentId!,
          target: node.id,
          type: "deletable",
          style: { stroke: "#94a3b8", strokeWidth: 2 },
          data: {
            canDelete,
            direction,
            onRequestDelete: () => {
              const nodeLabel = graphNodes.find(n => n.id === node.id)?.label || 'this branch';
              setDeleteConfirmation({ isOpen: true, nodeId: node.id, nodeLabel, status: 'confirm' });
            },
          } as DeletableEdgeData,
        };
      });

    const layouted = layoutMode === 'tidy'
      ? getTidyTreeLayout(rfNodes, rfEdges, direction)
      : getTreeLayout(rfNodes, rfEdges, direction);
    return { layoutedNodes: layouted.nodes, layoutedEdges: layouted.edges, rootIds: rootIdList, primaryRootId: primaryRoot };
  }, [graphNodes, rootNodeId, hiddenNodes, childMap, collapsedNodes, loadingNodeIds, layoutMode, direction, onDeleteNode]);

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
          onDirectionClick: () => {
            const isLoading = loadingNodeIds && (loadingNodeIds instanceof Set ? loadingNodeIds.size > 0 : loadingNodeIds.length > 0);
            if (isLoading || globalStatus?.isActive) {
              setStatusPillWarning("Trevi can only explore one topic at a time");
              setTimeout(() => setStatusPillWarning(undefined), 3000);
              return;
            }
            onDirectionClick?.(node.id);
          },
          onCloseExpanded: () => setExpandedNodeId(null),
        },
      };
    });
  }, [layoutedNodes, toggleCollapse, onDirectionClick, expandedNodeId, graphNodes, activePathNodeIds, activeNodeId, globalStatus, loadingNodeIds]);

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
      // Also set isNodeHovered for edges where target matches hovered node
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id.startsWith('panel-edge-')) return e;

          const isHoverPath = hoverEdgeIds.has(e.id);
          const isActivePath = activePathEdgeIds.has(e.id);
          const isHoverLastEdge = e.id === hoverLastEdge?.id;
          const isActiveLastEdge = e.id === lastEdgeId;
          // Check if this edge's target is the hovered node (for delete button)
          const isTargetHovered = e.target === node.id;

          if (isHoverPath) {
            return {
              ...e,
              data: { ...e.data, isNodeHovered: isTargetHovered },
              style: { stroke: "#3b82f6", strokeWidth: 5 },
              animated: true,
              zIndex: 1001,
              markerEnd: undefined,
            };
          } else if (isActivePath) {
            // Keep active path visible but dimmed during hover
            return {
              ...e,
              data: { ...e.data, isNodeHovered: isTargetHovered },
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
            data: { ...e.data, isNodeHovered: isTargetHovered },
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

    // Restore edge styling based on active path, reset isNodeHovered
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id.startsWith('panel-edge-')) return e;

        if (activePathEdgeIds.has(e.id)) {
          const isLastEdge = e.id === lastEdgeId;
          return {
            ...e,
            data: { ...e.data, isNodeHovered: false },
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
          data: { ...e.data, isNodeHovered: false },
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
      // Check if we are already exploring/active
      // If globalStatus.isActive is true, we deny exploring another node
      if (globalStatus?.isActive && node.id !== globalStatus.activeNodeLabel) {
        // Note: node.id is ID, activeNodeLabel is Label. This check is approximate.
        // Better check: if we are loading OR if we are in 'exploring' state (which implies streaming/loading)
        // Actually user said "currently a node is being explored".

        // Let's use loadingNodeIds first as a hard check for "busy"
        const isLoading = loadingNodeIds && (loadingNodeIds instanceof Set ? loadingNodeIds.size > 0 : loadingNodeIds.length > 0);

        if (isLoading || globalStatus.isActive) {
          // Only block if we are clicking a direction node (which triggers explore) 
          // OR if we want to block ANY node click that changes context?
          // User said "if the user clicks on any other explore node".
          // Direction nodes usually are the ones triggering exploration. 
          // Concept nodes just open panels.
          // Let's assume we block 'onNodeClick' which usually triggers exploration for direction nodes, or sets focus.

          // But wait, clicking a normal node just opens the panel/modal. That should be allowed?
          // User said "clicks on any other explore node". 'Explore node' implies 'Direction Node' or similar action-triggering node.

          // Let's check node data.
          const isDirectionNode = node.data?.isDirection;

          if (isDirectionNode) {
            setStatusPillWarning("Trevi can only explore one topic at a time");
            setTimeout(() => setStatusPillWarning(undefined), 3000);
            return;
          }
        }
      }

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
                streamUserMessage: nodeStreamUserMessage,
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
    [onNodeClick, graphNodes, setNodes, setEdges, viewMode, onNodeMessage, isNodeStreaming, nodeStatusMessage, nodeStreamUserMessage, getNodes]
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
          <StatusPill
            globalStatus={globalStatus}
            isExpanded={isStatusPillExpanded}
            onToggleExpand={() => setIsStatusPillExpanded(!isStatusPillExpanded)}
            warning={statusPillWarning}
          />
        </div>
      )}

      {/* Disclaimer - Bottom Center */}
      <TreviDisclaimer />

      {/* Chat Toggle Button - Top Right (hidden on mobile, we have tab navigation) */}
      {onToggleChatSidebar && (
        <div className="hidden md:block absolute top-4 right-4 z-30 bg-white rounded-lg shadow-md border border-slate-200 p-1">
          <ToolbarButton
            onClick={onToggleChatSidebar}
            isActive={isChatSidebarOpen}
            title="Full Conversation"
            tooltipPosition="left"
          >
            <MessageSquare className="w-5 h-5" />
          </ToolbarButton>
        </div>
      )}

      {/* Control Buttons - Bottom Left - Vertically Stacked Groups */}
      <div className="absolute bottom-4 left-4 z-30 flex flex-col gap-2">
        {/* Quick Feedback with Nudge Tooltip */}
        <div className="relative bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <QuickFeedback
            context="canvas"
            componentName="topic_tree_canvas"
            popoverPosition="right"
            size="lg"
            vertical
          />
          {/* Nudge tooltip appears from this container */}
          {showPeriodicFeedback && (
            <FeedbackNudgeTooltip
              onDismiss={handleDismissPeriodicFeedback}
              position="right"
            />
          )}
        </div>

        {/* DEPRECATED: View Mode Toggle (Panel vs Modal) - In-graph panel view deprecated, keeping modal only
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <ToolbarButton
            onClick={() => setViewMode('panel')}
            isActive={viewMode === 'panel'}
            title="Side Panel View"
          >
            <PanelRight className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setViewMode('modal')}
            isActive={viewMode === 'modal'}
            title="Center Modal View"
          >
            <Maximize className="w-5 h-5" />
          </ToolbarButton>
        </div>
        */}

        {/* Layout Mode Group */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <ToolbarButton
            onClick={() => setLayoutMode('custom')}
            isActive={layoutMode === 'custom'}
            title="Spacious Layout"
          >
            <GitBranch className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setLayoutMode('tidy')}
            isActive={layoutMode === 'tidy'}
            title="Compact Layout"
          >
            <Layers className="w-5 h-5" />
          </ToolbarButton>
        </div>

        {/* Direction Group */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <ToolbarButton
            onClick={() => setDirection('TB')}
            isActive={direction === 'TB'}
            title="Top to Bottom"
          >
            <ArrowDown className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setDirection('LR')}
            isActive={direction === 'LR'}
            title="Left to Right"
          >
            <ArrowRight className="w-5 h-5" />
          </ToolbarButton>
        </div>

        {/* Zoom Controls Group */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <ToolbarButton
            onClick={() => zoomIn({ duration: 200 })}
            title="Zoom In"
          >
            <Plus className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => zoomOut({ duration: 200 })}
            title="Zoom Out"
          >
            <Minus className="w-5 h-5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => fitView({ padding: 0.3, duration: 300 })}
            title="Fit to Screen"
          >
            <Maximize2 className="w-5 h-5" />
          </ToolbarButton>
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
        edgeTypes={edgeTypes}
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
          streamUserMessage={nodeStreamUserMessage}
          clickPosition={modalData.clickPosition}
          chatId={chatId}
          nodeId={modalData.nodeId}
          isRootNode={graphNodes.find(n => n.id === modalData.nodeId)?.parentId === null}
          briefCache={briefCache}
          onBriefCacheUpdate={onBriefCacheUpdate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation?.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteConfirmation.status === 'success' ? (
              // Success state
              <div className="flex flex-col items-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Branch deleted</h3>
                <p className="text-sm text-slate-500 mt-1">Successfully deleted</p>
              </div>
            ) : deleteConfirmation.status === 'deleting' ? (
              // Deleting state
              <div className="flex flex-col items-center py-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Deleting...</h3>
                <p className="text-sm text-slate-500 mt-1">Please wait</p>
              </div>
            ) : (
              // Confirm state
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Delete branch?</h3>
                    <p className="text-sm text-slate-500">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-5">
                  This will permanently delete <span className="font-medium text-slate-900">"{deleteConfirmation.nodeLabel}"</span> and all of its children.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmation(null)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const { nodeId, nodeLabel } = deleteConfirmation;
                      setDeleteConfirmation({ isOpen: true, nodeId, nodeLabel, status: 'deleting' });
                      try {
                        await onDeleteNode?.(nodeId);
                        setDeleteConfirmation({ isOpen: true, nodeId, nodeLabel, status: 'success' });
                        setTimeout(() => setDeleteConfirmation(null), 1500);
                      } catch (error) {
                        setDeleteConfirmation(null);
                      }
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
