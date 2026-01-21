"use client";

import { useEffect, useRef } from 'react';
import { Node, Edge, Position, useReactFlow } from '@xyflow/react';
import { hierarchy, tree } from 'd3-hierarchy';
import { LayoutResult } from './types';

// ============================================================================
// Layout Configuration Constants
// ============================================================================

export const NODE_HEIGHT = 50;
export const SIBLING_SEP = 60;  // Tight spacing between leaf siblings
export const SUBTREE_SEP = 140; // Larger spacing between different subtrees
export const RANK_SEP = 120; // Vertical spacing between levels

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to estimate node width based on label length
 */
export function getNodeWidth(label: string): number {
    return Math.max(200, (label?.length || 0) * 10 + 80);
}

/**
 * Finds the path from a node to its root by traversing edges backwards.
 */
export function findPathToRoot(
    nodeId: string,
    edges: Edge[],
    rootIds: string[] | string
): { nodeIds: Set<string>; edgeIds: Set<string> } {
    const nodeIds = new Set<string>([nodeId]);
    const edgeIds = new Set<string>();
    const rootIdSet = new Set(Array.isArray(rootIds) ? rootIds : [rootIds]);

    const parentMap = new Map<string, { parentId: string; edgeId: string }>();
    edges.forEach((edge) => {
        parentMap.set(edge.target, { parentId: edge.source, edgeId: edge.id });
    });

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
export function getDescendants(nodeId: string, edges: Edge[]): Set<string> {
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
// Spacious Tree Layout (Custom Algorithm)
// ============================================================================

/**
 * Custom tree layout algorithm that ensures each subtree stays within its own 
 * horizontal space, preventing children from invading sibling node territories.
 */
export function getTreeLayout(
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB'
): LayoutResult {
    if (nodes.length === 0) return { nodes: [], edges: [] };

    const isLR = direction === 'LR';
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();

    edges.forEach((edge) => {
        parentMap.set(edge.target, edge.source);
        const children = childrenMap.get(edge.source) || [];
        children.push(edge.target);
        childrenMap.set(edge.source, children);
    });

    const rootIds = nodes.filter((n) => !parentMap.has(n.id)).map(n => n.id);
    if (rootIds.length === 0) return { nodes, edges };

    const subtreeBreadths = new Map<string, number>();

    function calculateSubtreeBreadth(nodeId: string): number {
        const children = childrenMap.get(nodeId) || [];
        const node = nodes.find(n => n.id === nodeId);
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
                totalBreadth += (isLeaf && nextIsLeaf) ? SIBLING_SEP : SUBTREE_SEP;
            }
        });

        const breadth = Math.max(totalBreadth, nodeBreadth);
        subtreeBreadths.set(nodeId, breadth);
        return breadth;
    }

    rootIds.forEach(rootId => calculateSubtreeBreadth(rootId));

    const positions = new Map<string, { x: number; y: number }>();

    function positionNode(nodeId: string, x: number, y: number) {
        const subtreeBreadth = subtreeBreadths.get(nodeId) || 180;
        const node = nodes.find(n => n.id === nodeId);
        const nodeBreadth = isLR ? NODE_HEIGHT : (node ? getNodeWidth(node.data.label as string) : 180);
        const nodeDepth = isLR ? (node ? getNodeWidth(node.data.label as string) : 180) : NODE_HEIGHT;

        if (isLR) {
            positions.set(nodeId, { x, y: y + (subtreeBreadth - nodeBreadth) / 2 });
        } else {
            positions.set(nodeId, { x: x + (subtreeBreadth - nodeBreadth) / 2, y });
        }

        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) return;

        let currentBreadth = isLR ? y : x;
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
                currentBreadth += childSubtreeBreadth + ((isLeaf && nextIsLeaf) ? SIBLING_SEP : SUBTREE_SEP);
            }
        });
    }

    let totalAllTreesBreadth = 0;
    const treeBreadths: number[] = [];
    rootIds.forEach((rootId, index) => {
        const treeBreadth = subtreeBreadths.get(rootId) || 180;
        treeBreadths.push(treeBreadth);
        totalAllTreesBreadth += treeBreadth;
        if (index < rootIds.length - 1) totalAllTreesBreadth += SUBTREE_SEP * 2;
    });

    let currentTreeOffset = -totalAllTreesBreadth / 2;
    rootIds.forEach((rootId, index) => {
        if (isLR) {
            positionNode(rootId, 0, currentTreeOffset);
        } else {
            positionNode(rootId, currentTreeOffset, 0);
        }
        currentTreeOffset += treeBreadths[index];
        if (index < rootIds.length - 1) currentTreeOffset += SUBTREE_SEP * 2;
    });

    const layoutedNodes = nodes.map((node) => ({
        ...node,
        targetPosition: isLR ? Position.Left : Position.Top,
        sourcePosition: isLR ? Position.Right : Position.Bottom,
        position: positions.get(node.id) || { x: 0, y: 0 },
    }));

    return { nodes: layoutedNodes, edges };
}

// ============================================================================
// Compact Tree Layout (D3 Reingold-Tilford Algorithm)
// ============================================================================

/**
 * Tidy tree layout using d3-hierarchy's Reingold-Tilford algorithm.
 * This produces a more compact and balanced tree structure.
 */
export function getTidyTreeLayout(
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB'
): LayoutResult {
    if (nodes.length === 0) return { nodes: [], edges: [] };

    const isLR = direction === 'LR';
    const childMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();

    edges.forEach((edge) => {
        parentMap.set(edge.target, edge.source);
        const children = childMap.get(edge.source) || [];
        children.push(edge.target);
        childMap.set(edge.source, children);
    });

    const rootNodes = nodes.filter((n) => !parentMap.has(n.id));
    if (rootNodes.length === 0) return { nodes, edges };

    const allPositions = new Map<string, { x: number; y: number }>();
    const treeBounds: Array<{ minBreadth: number; maxBreadth: number }> = [];

    rootNodes.forEach((rootNode) => {
        const d3Root = hierarchy(rootNode, (d) => {
            const childrenIds = childMap.get(d.id);
            return childrenIds?.map(id => nodes.find(n => n.id === id)!) || null;
        });

        const treeLayout = tree<Node>();

        if (isLR) {
            const depthWidths = new Map<number, number>();
            d3Root.each((node) => {
                const width = getNodeWidth(node.data.data.label as string);
                const currentMax = depthWidths.get(node.depth) || 0;
                depthWidths.set(node.depth, Math.max(currentMax, width));
            });

            treeLayout
                .nodeSize([NODE_HEIGHT, 1])
                .separation((a, b) => (a.parent === b.parent ? SIBLING_SEP : SUBTREE_SEP) / NODE_HEIGHT + 1);

            treeLayout(d3Root);

            d3Root.each((node) => {
                let x = 0;
                for (let i = 0; i < node.depth; i++) {
                    x += (depthWidths.get(i) || 180) + RANK_SEP;
                }
                node.y = x;
            });
        } else {
            treeLayout
                .nodeSize([1, NODE_HEIGHT + RANK_SEP])
                .separation((a, b) => {
                    const widthA = getNodeWidth(a.data.data.label as string);
                    const widthB = getNodeWidth(b.data.data.label as string);
                    return (widthA + widthB) / 2 + (a.parent === b.parent ? SIBLING_SEP : SUBTREE_SEP);
                });

            treeLayout(d3Root);
        }

        let minBreadth = Infinity, maxBreadth = -Infinity;
        d3Root.each((node) => {
            const breadth = node.x ?? 0;
            minBreadth = Math.min(minBreadth, breadth);
            maxBreadth = Math.max(maxBreadth, breadth);
        });

        treeBounds.push({ minBreadth, maxBreadth });

        d3Root.each((d3Node) => {
            allPositions.set(d3Node.data.id, isLR
                ? { x: d3Node.y ?? 0, y: d3Node.x ?? 0 }
                : { x: d3Node.x ?? 0, y: d3Node.y ?? 0 });
        });
    });

    // Space out multiple trees
    if (rootNodes.length > 1) {
        let currentOffset = 0;

        rootNodes.forEach((rootNode, treeIndex) => {
            const bounds = treeBounds[treeIndex];
            const treeWidth = bounds.maxBreadth - bounds.minBreadth;
            const treeOffset = currentOffset - bounds.minBreadth;

            const treeNodeIds = new Set<string>();
            function collectTreeNodes(nodeId: string) {
                treeNodeIds.add(nodeId);
                (childMap.get(nodeId) || []).forEach(collectTreeNodes);
            }
            collectTreeNodes(rootNode.id);

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

            currentOffset += treeWidth + SUBTREE_SEP * 2;
        });

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

// ============================================================================
// Layout Animation Hook
// ============================================================================

/**
 * Animation hook for smooth layout transitions.
 * Handles entering, updating, and exiting nodes with spring-like animations.
 */
export function useLayoutAnimation(
    targetNodes: Node[],
    targetEdges: Edge[],
    setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void,
    setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void,
    onAnimationComplete?: () => void,
    skipAnimation?: boolean
) {
    const { getNodes } = useReactFlow();
    const animationFrameRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const startNodesRef = useRef<Map<string, Node>>(new Map());
    const prevTargetNodesRef = useRef<Node[]>([]);

    useEffect(() => {
        const currentNodes = getNodes();

        // Skip animation: set nodes/edges instantly
        if (skipAnimation || currentNodes.length === 0) {
            setNodes(targetNodes);
            setEdges(targetEdges);
            prevTargetNodesRef.current = targetNodes;
            onAnimationComplete?.();
            return;
        }

        const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]));
        const startNodeMap = new Map<string, Node>();
        const exitingNodes: Node[] = [];
        const panelNodes = currentNodes.filter(n => n.type === 'conversationPanel');

        const targetNodeIds = new Set(targetNodes.map(n => n.id));
        currentNodes.forEach(node => {
            if (!targetNodeIds.has(node.id) && node.type !== 'conversationPanel') {
                exitingNodes.push(node);
            }
        });

        targetNodes.forEach(targetNode => {
            const targetId = String(targetNode.id); // Ensure string ID
            if (currentNodeMap.has(targetId)) {
                startNodeMap.set(targetId, currentNodeMap.get(targetId)!);
            } else {
                const parentId = targetNode.data.parentId as string;
                let startPos = { x: 0, y: 0 };

                if (parentId && currentNodeMap.has(parentId)) {
                    startPos = currentNodeMap.get(parentId)!.position;
                } else if (parentId && startNodeMap.has(parentId)) {
                    startPos = startNodeMap.get(parentId)!.position;
                } else {
                    const root = currentNodes.find(n => n.data.isRoot);
                    if (root) startPos = root.position;
                }

                startNodeMap.set(targetNode.id, {
                    ...targetNode,
                    position: { ...startPos },
                    style: { ...targetNode.style, opacity: 0.5 }
                });
            }
        });

        const exitNodeMap = new Map<string, { start: Node, targetPos: { x: number, y: number } }>();
        exitingNodes.forEach(node => {
            const parentId = node.data.parentId as string;
            let targetPos = node.position;

            const parentInTarget = targetNodes.find(n => n.id === parentId);
            if (parentInTarget) {
                targetPos = parentInTarget.position;
            } else {
                let curr = node;
                while (curr.data.parentId) {
                    const pId = curr.data.parentId as string;
                    const pTarget = targetNodes.find(n => n.id === pId);
                    if (pTarget) {
                        targetPos = pTarget.position;
                        break;
                    }
                    const pCurrent = currentNodeMap.get(pId);
                    if (!pCurrent) break;
                    curr = pCurrent;
                }
            }
            exitNodeMap.set(node.id, { start: node, targetPos });
        });

        startNodesRef.current = startNodeMap;

        const duration = 1200;

        const animate = (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
            const t = 1 - Math.pow(1 - progress, 3);

            const nextTargetNodes = targetNodes.map(targetNode => {
                const targetId = String(targetNode.id);
                const startNode = startNodesRef.current.get(targetId);
                if (!startNode) return targetNode;

                const startOpacity = Number(startNode.style?.opacity ?? 1);
                const targetOpacity = Number(targetNode.style?.opacity ?? 1);
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
                    style: {
                        ...targetNode.style,
                        opacity: startOpacity + dOpacity * t
                    }
                };
            });

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
                        opacity: 1 - t,
                        pointerEvents: 'none' as const,
                    }
                };
            });

            // Deduplicate panel nodes to prevent key warnings if state gets corrupted
            const uniquePanelNodes = Array.from(new Map(panelNodes.map(n => [n.id, n])).values());

            const nextNodes = [...nextTargetNodes, ...nextExitingNodes, ...uniquePanelNodes];
            // STRICT DEDUPLICATION: Ensure no duplicate IDs exist and all are strings
            const uniqueNextNodes = Array.from(
                new Map(nextNodes.map(n => [String(n.id), { ...n, id: String(n.id) }])).values()
            );

            setNodes(uniqueNextNodes);

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                startTimeRef.current = null;
                const finalNodes = [...targetNodes, ...panelNodes];
                // STRICT DEDUPLICATION: Ensure no duplicate IDs exist and all are strings
                const uniqueFinalNodes = Array.from(
                    new Map(finalNodes.map(n => [String(n.id), { ...n, id: String(n.id) }])).values()
                );
                setNodes(uniqueFinalNodes);
                onAnimationComplete?.();
            }
        };

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        startTimeRef.current = null;
        animationFrameRef.current = requestAnimationFrame(animate);

        setEdges(currentEdges => {
            const panelEdges = currentEdges.filter(e => e.id.startsWith('panel-edge-'));
            const nonPanelTargetEdges = targetEdges.filter(e => !e.id.startsWith('panel-edge-'));
            return [...nonPanelTargetEdges, ...panelEdges];
        });

        prevTargetNodesRef.current = targetNodes;

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [targetNodes, targetEdges, setNodes, setEdges, getNodes, skipAnimation]);
}
