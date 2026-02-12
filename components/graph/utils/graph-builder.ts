import { CompleteEvent } from '@/lib/api';
import { GraphNode } from '../types';

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
            gistBullets: undefined, // Populated from graph API response, not CompleteEvent
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
