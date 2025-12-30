"use client";

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatInterface } from '@/components/chat/chat-interface';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { KnowledgeGraph, GraphNode, buildGraphFromResponses } from '@/components/graph/knowledge-graph';
import { GraphLoading } from '@/components/loading/graph-loading';
import {
  sendMessage,
  createNewChatRequest,
  createDirectedQueryRequest,
  createFollowUpRequest,
  getGraph,
  buildGraphNodesFromResponse,
  type CompleteEvent,
} from '@/lib/api';

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
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Chat sidebar state (full conversation)
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Get all conversation nodes for full sidebar (nodes with payloads, in order)
  const conversationNodes = useMemo(() => {
    return graphNodes
      .filter(n => n.payload && n.payload.length > 0)
      .map(n => ({
        id: n.id,
        label: n.label,
        payload: n.payload || [],
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
      }));
  }, [graphNodes, currentNodeId, rootNodeId]);

  // Handle sending a message from the landing page (always creates a new chat)
  const handleSendMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    setIsCreatingChat(true);
    setStatusMessage("Connecting...");
    setIsStreaming(true);

    try {
      const request = createNewChatRequest(message);

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
          setIsLoading(false);
          setIsCreatingChat(false);
        },
        (error) => {
          console.error("Message error:", error);
          setStatusMessage(`Error: ${error.error}`);
          setIsLoading(false);
          setIsCreatingChat(false);
          setIsStreaming(false);
        }
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      setStatusMessage("Failed to send message");
      setIsLoading(false);
      setIsCreatingChat(false);
      setIsStreaming(false);
    }
  }, [rootNodeId]);

  // Handle follow-up message from the full conversation sidebar
  const handleSidebarMessage = useCallback(async (message: string) => {
    if (!currentChatId || !currentNodeId || isStreaming) return;

    setIsStreaming(true);
    setStatusMessage("Connecting...");

    try {
      const request = createFollowUpRequest(message, currentChatId, currentNodeId);

      await sendMessage(
        request,
        (update) => {
          setStatusMessage(update.message);
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
        },
        (error) => {
          console.error("Follow-up error:", error);
          setStatusMessage(`Error: ${error.error}`);
          setIsStreaming(false);
        }
      );
    } catch (error) {
      console.error("Failed to send follow-up:", error);
      setStatusMessage("Failed to send message");
      setIsStreaming(false);
    }
  }, [currentChatId, currentNodeId, isStreaming]);

  // Handle selecting a chat from left sidebar
  const handleChatSelect = useCallback(async (chatId: string) => {
    setIsLoading(true);
    setStatusMessage("Loading conversation...");
    setCurrentChatId(chatId);

    try {
      const graphResponse = await getGraph(chatId);
      const { nodes, currentNodeId: nodeId, rootNodeId: root } = buildGraphNodesFromResponse(graphResponse);

      setGraphNodes(nodes);
      setCurrentNodeId(nodeId);
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
    setCurrentChatId(null);
    setCurrentNodeId(null);
    setRootNodeId(null);
    setResponses([]);
    responsesRef.current = [];
    setGraphNodes([]);
    setStatusMessage("");
    setIsLoading(false);
    setIsCreatingChat(false);
    setLoadingNodeId(null);
    setIsChatSidebarOpen(false);
    setIsStreaming(false);
  }, []);

  // Handle starting a new chat
  const handleNewChat = useCallback(() => {
    handleLogoClick();
  }, [handleLogoClick]);

  // Handle clicking a direction node to explore
  const handleDirectionClick = useCallback(async (nodeId: string) => {
    if (!currentChatId || loadingNodeId) return;

    setLoadingNodeId(nodeId);
    setIsStreaming(true);
    setStatusMessage("Exploring...");

    try {
      const request = createDirectedQueryRequest(currentChatId, nodeId);

      await sendMessage(
        request,
        (update) => {
          setStatusMessage(update.message);
        },
        (event) => {
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
              setStatusMessage("");
              setLoadingNodeId(null);
            });

          setIsStreaming(false);
        },
        (error) => {
          console.error("Direction query error:", error);
          setStatusMessage(`Error: ${error.error}`);
          setLoadingNodeId(null);
          setIsStreaming(false);
        }
      );
    } catch (error) {
      console.error("Failed to explore direction:", error);
      setStatusMessage("Failed to explore direction");
      setLoadingNodeId(null);
      setIsStreaming(false);
    }
  }, [currentChatId, loadingNodeId]);

  // Handle clicking a node in the graph (panel is handled internally by KnowledgeGraph)
  const handleNodeClick = useCallback((nodeId: string) => {
    setCurrentNodeId(nodeId);
  }, []);

  // Toggle full conversation sidebar
  const toggleChatSidebar = useCallback(() => {
    setIsChatSidebarOpen(prev => !prev);
  }, []);

  // Determine what to show
  const showLandingPage = !currentChatId && !isCreatingChat;
  const showLoadingPage = isCreatingChat;
  const showGraphPage = currentChatId && graphNodes.length > 0 && !isCreatingChat;

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      {/* Left Sidebar - Chat History */}
      <Sidebar
        selectedChatId={currentChatId}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
        onLogoClick={handleLogoClick}
        onChatDeleted={handleLogoClick}
      />

      {/* Main Content Area - flexes to accommodate right sidebar */}
      <main className="flex-1 flex h-full relative overflow-hidden">
        {/* Graph/Content Area */}
        <div className="flex-1 h-full overflow-hidden relative">
          {showLoadingPage ? (
            <GraphLoading />
          ) : showGraphPage ? (
            <KnowledgeGraph
              nodes={graphNodes}
              rootNodeId={rootNodeId || undefined}
              onNodeClick={handleNodeClick}
              onDirectionClick={handleDirectionClick}
              loadingNodeId={loadingNodeId}
              onToggleChatSidebar={toggleChatSidebar}
              isChatSidebarOpen={isChatSidebarOpen}
            />
          ) : (
            <ChatInterface
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              statusMessage={statusMessage}
            />
          )}
        </div>

        {/* Right Sidebar - Full Conversation (push style) */}
        <ChatSidebar
          isOpen={isChatSidebarOpen}
          conversationNodes={conversationNodes}
          threadNodes={threadNodes}
          rootLabel={graphNodes.find(n => n.id === rootNodeId)?.label || 'Conversation'}
          activeLabel={graphNodes.find(n => n.id === currentNodeId)?.label}
          isStreaming={isStreaming}
          statusMessage={statusMessage}
          onSendMessage={handleSidebarMessage}
          onClose={() => setIsChatSidebarOpen(false)}
        />
      </main>
    </div>
  );
}
