import { Node, Edge } from '@xyflow/react';
import { MessagePayload, Citation } from '@/lib/api';

// ============================================================================
// Core Types
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
    loadingNodeIds?: Set<string> | string[] | null; // Node IDs currently being loaded
    onToggleChatSidebar?: () => void; // Toggle full conversation sidebar
    isChatSidebarOpen?: boolean; // Whether the chat sidebar is open
    initialActiveNodeId?: string | null; // Active node to highlight on initial load
    onNodeMessage?: (nodeId: string, message: string) => void; // Callback for sending message from node panel
    isNodeStreaming?: boolean; // Whether a node panel is currently streaming
    nodeStatusMessage?: string; // Status message for node panel streaming
    // Global status indicator
    globalStatus?: GlobalStatus;
}

export interface GlobalStatus {
    isActive: boolean;
    message: string;
    type: 'streaming' | 'exploring' | 'idle';
    activeNodeLabel?: string;
    // Multi-connection support
    exploringNodeIds?: string[];
    exploringNodeLabels?: string[];
    // Error display
    errors?: Array<{ nodeId: string; nodeLabel: string; error: string; timestamp: number }>;
}

// ============================================================================
// Node Data Types
// ============================================================================

export interface ConceptNodeData {
    label: string;
    summary?: string;
    isHighlighted?: boolean;
    isInActivePath?: boolean;
    isActiveNode?: boolean;
    isRoot?: boolean;
    isCollapsed?: boolean;
    hasChildren?: boolean;
    childCount?: number;
    isDirection?: boolean;
    isLoading?: boolean;
    parentId?: string | null;
    direction?: 'TB' | 'LR';
    depth?: number;
    isExpanded?: boolean;
    messages?: MessagePayload[];
    citations?: Citation[];
    onToggleCollapse?: () => void;
    onDirectionClick?: () => void;
    onExpand?: () => void;
    onCloseExpanded?: () => void;
}

export interface ConversationPanelNodeData {
    messages: MessagePayload[];
    label: string;
    onClose: () => void;
    citations?: Citation[];
    onSendMessage?: (message: string) => void;
    isStreaming?: boolean;
    statusMessage?: string;
}

// ============================================================================
// UI Component Types
// ============================================================================

export interface ToolbarButtonProps {
    onClick: () => void;
    isActive?: boolean;
    title: string;
    children: React.ReactNode;
    className?: string;
}

export interface TooltipProps {
    content: string;
    position: { x: number; y: number };
}

export interface StatusPillProps {
    globalStatus: GlobalStatus;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

// ============================================================================
// Layout Types
// ============================================================================

export interface LayoutResult {
    nodes: Node[];
    edges: Edge[];
}
