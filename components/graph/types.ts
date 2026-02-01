import { Node, Edge } from '@xyflow/react';
import { MessagePayload, Citation, TreviBriefResponse } from '@/lib/api';

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
    rootNodeId?: string;
    rootNodeIds?: string[];
    onNodeClick?: (nodeId: string) => void;
    onDirectionClick?: (nodeId: string) => void;
    onDeleteNode?: (nodeId: string) => Promise<void>;
    loadingNodeIds?: Set<string> | string[] | null;
    unreadNodeIds?: Set<string> | null;
    onToggleChatSidebar?: () => void;
    isChatSidebarOpen?: boolean;
    initialActiveNodeId?: string | null;
    onNodeMessage?: (nodeId: string, message: string) => void;
    isNodeStreaming?: boolean;
    nodeStatusMessage?: string;
    nodeStreamUserMessage?: string;
    globalStatus?: GlobalStatus;
    // Brief cache for sharing between sidebar and modal
    chatId?: string;
    briefCache?: Map<string, BriefState>;
    onBriefCacheUpdate?: (nodeId: string, data: BriefState) => void;
    // Skip layout animation (useful when switching between chats)
    skipLayoutAnimation?: boolean;
    // Track visibility for mobile tab switches (triggers auto-fit when becoming visible)
    isVisible?: boolean;
}

export interface BriefState {
    data: TreviBriefResponse['trevi_brief'] | null;
    isLoading: boolean;
    error?: string;
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
    isBeaconActive?: boolean; // "You Are Here" pulsing beacon (dismissible)
    isUnread?: boolean;
    parentId?: string | null;
    direction?: 'TB' | 'LR';
    depth?: number;
    isExpanded?: boolean;
    messages?: MessagePayload[];
    citations?: Citation[];
    onToggleCollapse?: () => void;
    onDirectionClick?: () => void;
    onNodeClick?: () => void;
    onExpand?: () => void;
    onCloseExpanded?: () => void;
    onDelete?: () => void;
}

export interface ConversationPanelNodeData {
    messages: MessagePayload[];
    label: string;
    onClose: () => void;
    citations?: Citation[];
    onSendMessage?: (message: string) => void;
    isStreaming?: boolean;
    statusMessage?: string;
    streamUserMessage?: string;
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
    warning?: string;
}

// ============================================================================
// Layout Types
// ============================================================================

export interface LayoutResult {
    nodes: Node[];
    edges: Edge[];
}
