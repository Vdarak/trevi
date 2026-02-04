"use client";

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageBubble } from '../message-bubble';
import { NodeLabelBadge } from './node-label-badge';
import { StatusLine } from '@/components/ui/status-line';
import type { MessagePayload, Citation } from '@/lib/api';

interface DirectionNode {
    id: string;
    label: string;
}

export interface ConversationNode {
    id: string;
    label: string;
    payload: MessagePayload[];
    citations?: Citation[];
}

interface MessageListProps {
    /** Conversation nodes with their messages */
    nodes: ConversationNode[];
    /** Currently active node (for highlighting) */
    activeNodeId?: string;
    /** Whether to show node label badges (for multi-node views) */
    showNodeLabels?: boolean;
    /** Hide feedback buttons (for share views) */
    hideFeedback?: boolean;
    /** Whether streaming is active */
    isStreaming?: boolean;
    /** User message being streamed */
    streamUserMessage?: string;
    /** Status message during streaming */
    statusMessage?: string;
    /** Direction nodes for clickable bullets */
    directionNodes?: DirectionNode[];
    /** Click handler for direction nodes */
    onDirectionClick?: (nodeId: string) => void;
    /** Loading node IDs for spinner display */
    loadingNodeIds?: Set<string> | string[] | null;
    /** Edit message callback (for user messages) */
    onEditMessage?: (nodeId: string, newMessage: string) => void;
    /** Refs for scrolling to nodes */
    nodeRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
    /** Additional classes */
    className?: string;
    /** Empty state message */
    emptyMessage?: string;
    /** Empty state subtitle */
    emptySubtitle?: string;
}

/**
 * MessageList - Renders a list of conversation messages grouped by node.
 * 
 * Features:
 * - Node label badges for multi-node conversations
 * - Active node highlighting
 * - Streaming indicator with optimistic user message
 * - Edit support for user messages
 * - Direction node clickable links
 */
export function MessageList({
    nodes,
    activeNodeId,
    showNodeLabels = true,
    hideFeedback = false,
    isStreaming = false,
    streamUserMessage,
    statusMessage,
    directionNodes,
    onDirectionClick,
    loadingNodeIds,
    onEditMessage,
    nodeRefs,
    className,
    emptyMessage = 'No messages yet',
    emptySubtitle = 'Start exploring to see messages',
}: MessageListProps) {
    // Empty state
    if (nodes.length === 0 && !isStreaming) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-20 text-slate-400", className)}>
                <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">{emptyMessage}</p>
                <p className="text-xs mt-1 opacity-70">{emptySubtitle}</p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            {nodes.map((node, idx) => (
                <section
                    key={node.id}
                    ref={(el: HTMLDivElement | null) => { if (el && nodeRefs) nodeRefs.current.set(node.id, el); }}
                    data-node-id={node.id}
                    className={idx > 0 ? 'pt-4 border-t border-slate-100' : ''}
                >
                    {/* Node Label Badge */}
                    {showNodeLabels && nodes.length > 1 && (
                        <NodeLabelBadge
                            label={node.label}
                            isActive={node.id === activeNodeId}
                        />
                    )}

                    {/* Messages */}
                    <div className="space-y-4">
                        {(node.payload || []).map((msg, msgIdx) => (
                            <MessageBubble
                                key={`${node.id}-${msgIdx}`}
                                role={msg.role}
                                content={msg.content}
                                citations={node.citations}
                                onEdit={msg.role === 'user' && onEditMessage && !isStreaming
                                    ? (text) => onEditMessage(node.id, text)
                                    : undefined}
                                directionNodes={msg.role === 'assistant' ? directionNodes : undefined}
                                onDirectionClick={msg.role === 'assistant' ? onDirectionClick : undefined}
                                loadingNodeIds={msg.role === 'assistant' ? loadingNodeIds : undefined}
                                hideFeedback={hideFeedback}
                                nodeId={node.id}
                            />
                        ))}
                    </div>
                </section>
            ))}

            {/* Optimistic User Message & Streaming Indicator */}
            {isStreaming && (
                <>
                    {/* Show user message immediately */}
                    <div className="pt-4 border-t border-slate-100 animate-fade-in">
                        <MessageBubble
                            role="user"
                            content={streamUserMessage || statusMessage || ""}
                        />
                    </div>

                    {/* Status Line */}
                    <div className="py-2 animate-fade-in">
                        <StatusLine
                            status="exploring"
                            title="Exploring"
                            subtitle={statusMessage || "Processing..."}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
