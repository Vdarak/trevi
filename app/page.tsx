"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Menu, Map as MapIcon, MessageSquare } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatInterface } from '@/components/chat/chat-interface';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { KnowledgeGraph, GraphNode, buildGraphFromResponses } from '@/components/graph/knowledge-graph';
import { TreviLogoAnimation, TreviLogoStatic } from '@/components/ui/trevi-logo';
import { GraphLoading } from '@/components/loading/graph-loading';
import {
  sendMessage,
  editChatResponse,
  createNewChatRequest,
  createDirectedQueryRequest,
  createFollowUpRequest,
  getGraph,
  buildGraphNodesFromResponse,
  deleteNode,
  type CompleteEvent,
} from '@/lib/api';
import { ConnectionManager, type ConnectionError } from '@/lib/connection-manager';

export default function Home() {
  // Chat state
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);

  // Graph state
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [responses, setResponses] = useState<CompleteEvent[]>([]);
  const responsesRef = useRef<CompleteEvent[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isLoadingTransition, setIsLoadingTransition] = useState(false); // Visual transition state
  // Multi-connection state for parallel explorations
  const connectionManagerRef = useRef(new ConnectionManager());
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(new Set());
  const [connectionErrors, setConnectionErrors] = useState<ConnectionError[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [processingQuery, setProcessingQuery] = useState<string | null>(null);

  // Subscribe to ConnectionManager changes
  useEffect(() => {
    const manager = connectionManagerRef.current;
    const unsubscribe = manager.subscribe(() => {
      setLoadingNodeIds(new Set(manager.getActiveNodeIds()));
      setConnectionErrors(manager.getRecentErrors());
    });
    return unsubscribe;
  }, []);

  // Chat sidebar state (full conversation)
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Node conversation panel streaming state (for modal)
  const [isNodeStreaming, setIsNodeStreaming] = useState(false);
  const [nodeStatusMessage, setNodeStatusMessage] = useState('');

  // Separate states for the "User Message" bubble content vs the "Status Line" text
  // This allows the bubble to show "Explore X in relation to Y" while status shows "X"
  const [streamingUserMessage, setStreamingUserMessage] = useState<string>("");
  const [nodeStreamingUserMessage, setNodeStreamingUserMessage] = useState<string>("");

  // Mobile state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'graph' | 'chat'>('graph');

  // Pending chats for optimistic UI (SWR pattern)
  const [pendingChats, setPendingChats] = useState<Array<{ id: string, name: string, isLoading: boolean }>>([]);

  // Get all conversation nodes for full sidebar (nodes with payloads, in order)
  const conversationNodes = useMemo(() => {
    return graphNodes
      .filter(n => n.payload && n.payload.length > 0)
      .map(n => ({
        id: n.id,
        label: n.label,
        payload: n.payload || [],
        citations: n.citations,
      }));
  }, [graphNodes]);

  // Get thread nodes (path from root to current node) for current thread tab
  const threadNodes = useMemo(() => {
    if (!currentNodeId || !rootNodeId) return [];

    // Build parent map
    const parentMap = new Map<string, string>();
    graphNodes.forEach(n => {
      if (n.parentId) parentMap.set(n.id, n.parentId);
    });

    // Trace path from current to root
    const path: string[] = [];
    let nodeId: string | null = currentNodeId;
    while (nodeId) {
      path.unshift(nodeId);
      nodeId = parentMap.get(nodeId) || null;
    }

    // Return nodes on path with payloads
    return path
      .map(id => graphNodes.find(n => n.id === id))
      .filter((n): n is GraphNode => !!n && !!n.payload && n.payload.length > 0)
      .map(n => ({
        id: n.id,
        label: n.label,
        payload: n.payload || [],
        citations: n.citations,
      }));
  }, [graphNodes, currentNodeId, rootNodeId]);

  // Handle sending a message from the landing page (always creates a new chat)
  const handleSendMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    setIsCreatingChat(true);
    setIsLoadingTransition(true);
    setStatusMessage(message);
    setStreamingUserMessage(message); // Same for normal messages
    setProcessingQuery(message);
    setIsStreaming(true);

    try {
      const request = createNewChatRequest(message);

      // Add optimistic pending chat with query as name
      const pendingId = `pending-${Date.now()}`;
      setPendingChats(prev => [...prev, { id: pendingId, name: message.slice(0, 50) + (message.length > 50 ? '...' : ''), isLoading: true }]);

      await sendMessage(
        request,
        (update) => {
          setStatusMessage(update.message);
        },
        (event) => {
          setCurrentChatId(event.chat_id);
          setCurrentNodeId(event.node_id);

          if (!rootNodeId) {
            setRootNodeId(event.node_id);
          }

          // Fetch full graph to ensure sidebar has complete data
          getGraph(event.chat_id)
            .then((graphResponse) => {
              const { nodes } = buildGraphNodesFromResponse(graphResponse);
              setGraphNodes(nodes);
            })
            .catch(() => {
              // Fallback to building from responses
              const newResponses = [...responsesRef.current, event];
              responsesRef.current = newResponses;
              setResponses(newResponses);
              setGraphNodes(buildGraphFromResponses(newResponses));
            });

          setIsStreaming(false);
          setStatusMessage("");
          setStreamingUserMessage("");
          setProcessingQuery(null);
          setIsLoading(false);
          setIsCreatingChat(false);
          setIsLoading(false);
          setIsCreatingChat(false);

          // Remove pending chat now that real chat exists
          setPendingChats([]);
        },
        (error) => {
          console.error("Message error:", error);
          setStatusMessage(`Error: ${error.error}`);
          setIsLoading(false);
          setIsCreatingChat(false);
          setIsStreaming(false);
          setProcessingQuery(null);
        }
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      setStatusMessage("Failed to send message");
      setIsLoading(false);
      setIsCreatingChat(false);
      setIsStreaming(false);
      setProcessingQuery(null);
      setPendingChats([]); // Clear pending on error
    }
  }, [rootNodeId]);

  // Handle follow-up message from the full conversation sidebar
  const handleSidebarMessage = useCallback(async (message: string) => {
    if (!currentChatId || !currentNodeId || isStreaming) return;

    setIsStreaming(true);
    setStatusMessage(message);
    setStreamingUserMessage(message); // Same for normal messages
    setProcessingQuery(message);
    // Sync with node streaming state for modal
    setIsNodeStreaming(true);
    setNodeStatusMessage(message);
    setNodeStreamingUserMessage(message);

    try {
      const request = createFollowUpRequest(message, currentChatId, currentNodeId);

      await sendMessage(
        request,
        (update) => {
          setStatusMessage(update.message);
          setNodeStatusMessage(update.message);
        },
        (event) => {
          setCurrentNodeId(event.node_id);

          getGraph(event.chat_id)
            .then((graphResponse) => {
              const { nodes } = buildGraphNodesFromResponse(graphResponse);
              setGraphNodes(nodes);
            })
            .catch(console.error);

          setIsStreaming(false);
          setStatusMessage("");
          setStreamingUserMessage("");
          setProcessingQuery(null);
          // Also clear node streaming state
          setIsNodeStreaming(false);
          setNodeStatusMessage("");
          setNodeStreamingUserMessage("");
        },
        (error) => {
          console.error("Follow-up error:", error);
          setStatusMessage(`Error: ${error.error}`);
          setIsStreaming(false);
          setProcessingQuery(null);
          setIsNodeStreaming(false);
          setNodeStatusMessage("");
          setNodeStreamingUserMessage("");
        }
      );
    } catch (error) {
      console.error("Failed to send follow-up:", error);
      setStatusMessage("Failed to send message");
      setIsStreaming(false);
      setProcessingQuery(null);
      setIsNodeStreaming(false);
      setNodeStatusMessage("");
      setNodeStreamingUserMessage("");
    }
  }, [currentChatId, currentNodeId, isStreaming]);

  const handleEditMessage = useCallback(async (nodeId: string, newMessage: string) => {
    if (!currentChatId || isStreaming) return;

    setIsStreaming(true);
    setStatusMessage(newMessage); // Show the new query as status
    setStreamingUserMessage(newMessage);
    setProcessingQuery(newMessage);

    try {
      const response = await editChatResponse(currentChatId, nodeId, newMessage);

      // Update state with new node
      setCurrentNodeId(response.node_id);

      // Refresh graph to reflect changes (subtree deletion and new path)
      const graphResponse = await getGraph(currentChatId);
      const { nodes } = buildGraphNodesFromResponse(graphResponse);
      setGraphNodes(nodes);

      setIsStreaming(false);
      setStatusMessage("");
      setProcessingQuery(null);
    } catch (error) {
      console.error("Failed to edit message:", error);
      setStatusMessage("Failed to edit message");
      setIsStreaming(false);
      setProcessingQuery(null);
    }
  }, [currentChatId, isStreaming]);

  // Handle deleting a node and all its descendants
  const handleDeleteNode = useCallback(async (nodeId: string): Promise<void> => {
    if (!currentChatId) {
      throw new Error("No chat selected");
    }

    // Don't allow deletion while exploring/streaming
    const isAnyLoading = loadingNodeIds.size > 0 || isStreaming || isLoading;
    if (isAnyLoading) {
      throw new Error("Cannot delete while exploring");
    }

    const response = await deleteNode(currentChatId, nodeId);

    // Update current node to what the API returns (parent of deleted node)
    setCurrentNodeId(response.current_node);

    // Update graph with the new data from API response
    const graphResponse = {
      session_id: response.session_id,
      chat_id: response.chat_id,
      graph: response.graph,
      current_node: response.current_node,
    };
    const { nodes } = buildGraphNodesFromResponse(graphResponse);
    setGraphNodes(nodes);
  }, [currentChatId, loadingNodeIds, isStreaming, isLoading]);

  // Handle selecting a chat from left sidebar
  const handleChatSelect = useCallback(async (chatId: string) => {
    // Close chat sidebar when selecting a different chat
    setIsChatSidebarOpen(false);
    setIsLoading(true);
    setStatusMessage("Loading conversation...");
    setCurrentChatId(chatId);

    try {
      const graphResponse = await getGraph(chatId);
      const { nodes, currentNodeId: nodeId, rootNodeId: root } = buildGraphNodesFromResponse(graphResponse);

      setGraphNodes(nodes);

      // Restore active node from localStorage if available, otherwise use API's current_node
      const savedNodeId = localStorage.getItem(`trevi-active-node-${chatId}`);
      const activeNodeId = savedNodeId && nodes.some(n => n.id === savedNodeId) ? savedNodeId : nodeId;
      setCurrentNodeId(activeNodeId);

      setRootNodeId(root);
      setResponses([]);
      setStatusMessage("");
    } catch (error) {
      console.error("Failed to load chat graph:", error);
      setStatusMessage("Failed to load conversation");
      setGraphNodes([]);
      setCurrentNodeId(null);
      setRootNodeId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle clicking logo to go back to landing page
  const handleLogoClick = useCallback(() => {
    // Cancel all active explorations
    connectionManagerRef.current.cancelAll();
    setCurrentChatId(null);
    setCurrentNodeId(null);
    setRootNodeId(null);
    setResponses([]);
    responsesRef.current = [];
    setGraphNodes([]);
    setStatusMessage("");
    setIsLoading(false);
    setIsCreatingChat(false);
    setIsChatSidebarOpen(false);
    setIsStreaming(false);
  }, []);

  // Handle starting a new chat
  const handleNewChat = useCallback(() => {
    handleLogoClick();
  }, [handleLogoClick]);

  // Handle clicking a direction node to explore (supports multiple concurrent explorations)
  const handleDirectionClick = useCallback(async (nodeId: string) => {
    if (!currentChatId) return;

    // Check if this specific node is already loading
    if (connectionManagerRef.current.isLoading(nodeId)) return;

    // Get node and parent labels for formatted explore message
    const clickedNode = graphNodes.find(n => n.id === nodeId);
    const nodeLabel = clickedNode?.label || 'topic';
    const parentNode = clickedNode?.parentId ? graphNodes.find(n => n.id === clickedNode.parentId) : null;
    const parentLabel = parentNode?.label || 'root';

    // Create formatted explore message
    const exploreMessage = `|-> Explore - '${nodeLabel}' in relation to - '${parentLabel}'`;

    // Start tracking this connection
    const abortController = connectionManagerRef.current.start(nodeId, nodeLabel);
    setIsStreaming(true);
    setStatusMessage(nodeLabel); // Short label for status
    setProcessingQuery(nodeLabel); // Short label for global pill
    setStreamingUserMessage(exploreMessage); // Long message for bubble

    // Also sync with node streaming state for modals
    setNodeStatusMessage(nodeLabel); // Short label
    setNodeStreamingUserMessage(exploreMessage); // Long message
    setIsNodeStreaming(true);
    // Auto-open sidebar when exploring a direction
    setIsChatSidebarOpen(true);

    try {
      const request = createDirectedQueryRequest(currentChatId, nodeId);

      await sendMessage(
        request,
        (update) => {
          // Only update status if this is the only active connection
          if (connectionManagerRef.current.getActiveCount() === 1) {
            setStatusMessage(update.message);
          }
        },
        (event) => {
          // Mark connection as complete
          connectionManagerRef.current.complete(nodeId);
          setCurrentNodeId(event.node_id);

          getGraph(event.chat_id)
            .then((graphResponse) => {
              const { nodes } = buildGraphNodesFromResponse(graphResponse);
              setGraphNodes(nodes);
            })
            .catch((fetchError) => {
              console.error("Failed to refresh graph:", fetchError);
              const newResponses = [...responsesRef.current, event];
              responsesRef.current = newResponses;
              setResponses(newResponses);
              setGraphNodes(buildGraphFromResponses(newResponses));
            })
            .finally(() => {
              // Clear status if no more active connections
              if (connectionManagerRef.current.getActiveCount() === 0) {
                setStatusMessage("");
                setProcessingQuery(null);
                setStreamingUserMessage("");
                setIsStreaming(false);
                // Also clear node streaming state
                setNodeStatusMessage("");
                setNodeStreamingUserMessage("");
                setIsNodeStreaming(false);
              }
            });
        },
        (error) => {
          console.error("Direction query error:", error);
          connectionManagerRef.current.error(nodeId, error.error || 'Failed to explore');

          if (connectionManagerRef.current.getActiveCount() === 0) {
            setIsStreaming(false);
            setIsNodeStreaming(false);
            setNodeStatusMessage("");
            setNodeStreamingUserMessage("");
            setProcessingQuery(null);
            setStreamingUserMessage("");
          }
        },
        { signal: abortController.signal }
      );
    } catch (error) {
      // Check if this was an intentional abort
      if (error instanceof Error && error.name === 'AbortError') {
        // Intentional cancellation - don't show error
        connectionManagerRef.current.complete(nodeId);
      } else {
        console.error("Failed to explore direction:", error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to explore';
        connectionManagerRef.current.error(nodeId, errorMessage);
      }

      if (connectionManagerRef.current.getActiveCount() === 0) {
        setIsStreaming(false);
        setIsNodeStreaming(false);
        setNodeStatusMessage("");
        setProcessingQuery(null);
      }
    }
  }, [currentChatId, graphNodes]);

  // Handle clicking a node in the graph (panel is handled internally by KnowledgeGraph)
  const handleNodeClick = useCallback((nodeId: string) => {
    setCurrentNodeId(nodeId);
    // Auto-open sidebar when clicking on a node
    setIsChatSidebarOpen(true);
  }, []);

  // Handle sending a message from node conversation panel (uses query mode)
  const handleNodeMessage = useCallback(async (nodeId: string, message: string) => {
    if (!currentChatId || isNodeStreaming) return;

    setIsNodeStreaming(true);
    setNodeStatusMessage(message);
    setProcessingQuery(message);
    // Sync with sidebar streaming state
    setIsStreaming(true);
    setStatusMessage(message);

    try {
      const request = createFollowUpRequest(message, currentChatId, nodeId);

      await sendMessage(
        request,
        (update) => {
          setNodeStatusMessage(update.message);
          setStatusMessage(update.message);
        },
        (event) => {
          // Update current node to the new response node
          setCurrentNodeId(event.node_id);

          // Refresh graph to get updated data
          getGraph(event.chat_id)
            .then((graphResponse) => {
              const { nodes } = buildGraphNodesFromResponse(graphResponse);
              setGraphNodes(nodes);
            })
            .catch(console.error);

          setIsNodeStreaming(false);
          setNodeStatusMessage("");
          setProcessingQuery(null);
          // Also clear sidebar streaming state
          setIsStreaming(false);
          setStatusMessage("");
        },
        (error) => {
          console.error("Node message error:", error);
          setNodeStatusMessage(`Error: ${error.error}`);
          setIsNodeStreaming(false);
          setProcessingQuery(null);
          setIsStreaming(false);
          setStatusMessage("");
        }
      );
    } catch (error) {
      console.error("Failed to send node message:", error);
      setNodeStatusMessage("Failed to send message");
      setIsNodeStreaming(false);
      setProcessingQuery(null);
      setIsStreaming(false);
      setStatusMessage("");
    }
  }, [currentChatId, isNodeStreaming]);

  // Persist active node to localStorage when it changes
  useEffect(() => {
    if (currentChatId && currentNodeId) {
      localStorage.setItem(`trevi-active-node-${currentChatId}`, currentNodeId);
    }
  }, [currentChatId, currentNodeId]);

  // Toggle full conversation sidebar
  const toggleChatSidebar = useCallback(() => {
    setIsChatSidebarOpen(prev => !prev);
  }, []);

  // Determine what to show
  const showLandingPage = !currentChatId && !isCreatingChat;
  const showLoadingPage = isCreatingChat || isLoadingTransition;
  const showGraphPage = !!currentChatId && graphNodes.length > 0 && !isCreatingChat;

  return (
    <div className="flex h-dvh w-full bg-white overflow-hidden">
      {/* Mobile Hamburger Button - floating button to open sidebar (hidden when sidebar is open) */}
      {!isMobileSidebarOpen && (
        <div className="fixed top-4 left-4 z-40 md:hidden">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Home Header - centered Trevi logo (only on landing page) */}
      {showLandingPage && !isMobileSidebarOpen && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 md:hidden flex items-center gap-2">
          <TreviLogoStatic size={32} />
          <span className="text-xl font-semibold text-slate-900 tracking-tight">trevi</span>
        </div>
      )}

      {/* Left Sidebar - Knowledge Spaces */}
      <Sidebar
        selectedChatId={currentChatId}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
        onLogoClick={handleLogoClick}
        onChatDeleted={handleLogoClick}
        isCreatingChat={isCreatingChat}
        pendingChats={pendingChats}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area - flexes to accommodate right sidebar */}
      <main className="flex-1 flex flex-col md:flex-row h-full relative overflow-hidden">
        {/* Mobile Tab Bar - bottom navigation */}
        {showGraphPage && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex md:hidden">
            <button
              onClick={() => setMobileActiveTab('graph')}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${mobileActiveTab === 'graph' ? 'text-blue-600' : 'text-slate-400'
                }`}
            >
              <MapIcon className="w-5 h-5" />
              <span className="text-xs font-medium">Graph</span>
            </button>
            <button
              onClick={() => { setMobileActiveTab('chat'); setIsChatSidebarOpen(true); }}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${mobileActiveTab === 'chat' ? 'text-blue-600' : 'text-slate-400'
                }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-xs font-medium">Chat</span>
            </button>
          </div>
        )}

        {/* Graph/Content Area */}
        <div className={`flex-1 h-full overflow-hidden relative ${showGraphPage ? 'pb-16 md:pb-0' : ''}`}>
          {showLoadingPage ? (
            <GraphLoading
              query={processingQuery || undefined}
              isFinished={!isCreatingChat && isLoadingTransition}
              onTransitionComplete={() => {
                setIsLoadingTransition(false);
                setIsChatSidebarOpen(true); // Open sidebar only after transition completes
              }}
            />
          ) : showGraphPage ? (
            // On mobile, show either graph or chat based on tab
            <div className={`h-full ${mobileActiveTab === 'chat' ? 'hidden md:block' : ''}`}>
              <KnowledgeGraph
                nodes={graphNodes}
                rootNodeId={rootNodeId || undefined}
                onNodeClick={handleNodeClick}
                onDirectionClick={handleDirectionClick}
                onDeleteNode={handleDeleteNode}
                loadingNodeIds={loadingNodeIds}
                onToggleChatSidebar={toggleChatSidebar}
                isChatSidebarOpen={isChatSidebarOpen}
                initialActiveNodeId={currentNodeId}
                onNodeMessage={handleNodeMessage}
                isNodeStreaming={isNodeStreaming}
                nodeStatusMessage={nodeStatusMessage}
                nodeStreamUserMessage={nodeStreamingUserMessage}
                globalStatus={{
                  isActive: isStreaming || isNodeStreaming || isLoading || loadingNodeIds.size > 0,
                  message: statusMessage || nodeStatusMessage,
                  type: (isStreaming || isNodeStreaming) ? 'streaming' : loadingNodeIds.size > 0 ? 'exploring' : 'idle',
                  activeNodeLabel: graphNodes.find(n => n.id === currentNodeId)?.label,
                  exploringNodeIds: Array.from(loadingNodeIds),
                  exploringNodeLabels: processingQuery
                    ? [processingQuery]
                    : Array.from(loadingNodeIds)
                      .map(id => graphNodes.find(n => n.id === id)?.label)
                      .filter((label): label is string => !!label),
                  errors: connectionErrors
                }}
              />
            </div>
          ) : (
            <ChatInterface
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              statusMessage={statusMessage}
            />
          )}
        </div>

        {/* Right Sidebar - Full Conversation (push style on desktop, full screen on mobile) */}
        <div className={`
          ${mobileActiveTab === 'chat' && showGraphPage ? 'flex md:flex' : 'hidden md:flex'}
          ${isChatSidebarOpen ? 'md:flex' : 'md:hidden'}
        `}>
          <ChatSidebar
            isOpen={isChatSidebarOpen || (mobileActiveTab === 'chat' && showGraphPage)}
            chatId={currentChatId || undefined}
            conversationNodes={conversationNodes}
            threadNodes={threadNodes}
            rootLabel={graphNodes.find(n => n.id === rootNodeId)?.label || 'Conversation'}
            activeLabel={graphNodes.find(n => n.id === currentNodeId)?.label}
            activeNodeId={currentNodeId || undefined}
            isStreaming={isStreaming}
            statusMessage={statusMessage}
            streamUserMessage={streamingUserMessage}
            onSendMessage={handleSidebarMessage}
            onEditMessage={handleEditMessage}
            onClose={() => { setIsChatSidebarOpen(false); setMobileActiveTab('graph'); }}
          />
        </div>
      </main>
    </div>
  );
}
