"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Menu, Network, MessageSquare } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatInterface } from '@/components/chat/chat-interface';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { KnowledgeGraph, GraphNode, buildGraphFromResponses } from '@/components/graph/knowledge-graph';
import { TreviLogoAnimation, TreviLogoStatic } from '@/components/ui/trevi-logo';
import { GraphLoading } from '@/components/loading/graph-loading';
import {
  sendMessage,
  editChatResponse,
  createDirectedQueryRequest,
  createFollowUpRequest,
  getGraph,
  buildGraphNodesFromResponse,
  deleteNode,
  type CompleteEvent,
  type TreviBriefResponse,
  pollForCompletion,
} from '@/lib/api';
import { ConnectionManager, type ConnectionError } from '@/lib/connection-manager';
import { ChatStoreProvider, useChatStore } from '@/lib/chat-store';
import type { BriefState } from '@/components/graph/types';

function HomeContent() {
  // ChatStore for centralized state
  const { startChatCreation, startBackgroundPolling, refreshChats } = useChatStore();

  // Chat state
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null); // Stable ref for async callbacks
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);

  // Track if user is still watching the loading screen (for background polling)
  const isWatchingLoadingRef = useRef<boolean>(false);
  const currentPendingTempIdRef = useRef<string | null>(null);

  // Graph state
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [responses, setResponses] = useState<CompleteEvent[]>([]);
  const responsesRef = useRef<CompleteEvent[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isLoadingTransition, setIsLoadingTransition] = useState(false); // Visual transition state
  const [isError, setIsError] = useState(false); // Error state for loading screen
  const [errorMessage, setErrorMessage] = useState<string>(""); // Error message to display
  // Multi-connection state for parallel explorations
  const connectionManagerRef = useRef(new ConnectionManager());
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(new Set());
  const [connectionErrors, setConnectionErrors] = useState<ConnectionError[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [processingQuery, setProcessingQuery] = useState<string | null>(null);

  // Unread nodes state
  const [unreadNodeIds, setUnreadNodeIds] = useState<Set<string>>(new Set());

  // Load unread nodes from localStorage when chat changes
  useEffect(() => {
    if (currentChatId) {
      const savedUnread = localStorage.getItem(`trevi-unread-${currentChatId}`);
      if (savedUnread) {
        try {
          setUnreadNodeIds(new Set(JSON.parse(savedUnread)));
        } catch (e) {
          console.error("Failed to parse unread nodes:", e);
          setUnreadNodeIds(new Set());
        }
      } else {
        setUnreadNodeIds(new Set());
      }
    } else {
      setUnreadNodeIds(new Set());
    }
  }, [currentChatId]);

  // Persist unread nodes to localStorage whenever they change
  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem(`trevi-unread-${currentChatId}`, JSON.stringify(Array.from(unreadNodeIds)));
    }
  }, [unreadNodeIds, currentChatId]);

  // Subscribe to ConnectionManager changes (chat-scoped)
  useEffect(() => {
    const manager = connectionManagerRef.current;
    const unsubscribe = manager.subscribe(() => {
      // Only show loading nodes for the current chat
      const chatId = currentChatIdRef.current;
      setLoadingNodeIds(new Set(manager.getActiveNodeIds(chatId ?? undefined)));
      setConnectionErrors(manager.getRecentErrors());
    });
    return unsubscribe;
  }, []);

  // Keep currentChatIdRef in sync with currentChatId state
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
    // Trigger a re-check of loading nodes when chat changes
    const manager = connectionManagerRef.current;
    setLoadingNodeIds(new Set(manager.getActiveNodeIds(currentChatId ?? undefined)));
  }, [currentChatId]);

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

  // Brief cache: nodeId -> brief state (shared between sidebar and modal)
  const [briefCache, setBriefCache] = useState<Map<string, BriefState>>(new Map());

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
    // Mark that we're watching this loading screen
    isWatchingLoadingRef.current = true;

    setIsLoading(true);
    setIsCreatingChat(true);
    setIsLoadingTransition(true);
    setStatusMessage(message);
    setStreamingUserMessage(message);
    setProcessingQuery(message);
    setIsStreaming(true);

    // Create pending chat in the store
    const tempId = startChatCreation(message);
    currentPendingTempIdRef.current = tempId;

    // Start background polling via ChatStore
    startBackgroundPolling(
      tempId,
      message,
      // onComplete callback
      (event, wasWatching) => {
        if (wasWatching) {
          // User stayed on loading screen - update UI fully
          setCurrentChatId(event.chat_id);

          // Initial set from event (optimistic/immediate)
          setCurrentNodeId(event.node_id);
          setRootNodeId(event.node_id); // Always set for new chats

          // On mobile, default to chat tab after first query completes
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setMobileActiveTab('chat');
          }

          // Fetch full graph - wait for it before clearing loading states
          getGraph(event.chat_id)
            .then((graphResponse) => {
              const { nodes, currentNodeId: graphCurrentNode, rootNodeId: graphRootNode } = buildGraphNodesFromResponse(graphResponse);
              setGraphNodes(nodes);

              // Update IDs to match exactly what's in the graph response
              // This is critical to ensure the sidebar can find the nodes
              if (graphCurrentNode) setCurrentNodeId(graphCurrentNode);
              if (graphRootNode) setRootNodeId(graphRootNode);

              // Only clear loading states AFTER graph is loaded
              setIsStreaming(false);
              setStatusMessage("");
              setStreamingUserMessage("");
              setProcessingQuery(null);
              setIsLoading(false);
              setIsCreatingChat(false);
            })
            .catch(() => {
              // Fallback to building from responses
              const newResponses = [...responsesRef.current, event];
              responsesRef.current = newResponses;
              setResponses(newResponses);
              setGraphNodes(buildGraphFromResponses(newResponses));

              // Also clear loading states on fallback
              setIsStreaming(false);
              setStatusMessage("");
              setStreamingUserMessage("");
              setProcessingQuery(null);
              setIsLoading(false);
              setIsCreatingChat(false);
            });
        } else {
          // User navigated away - just clear loading states, don't navigate
          setIsCreatingChat(false);
          setIsLoading(false);
          setIsLoadingTransition(false);
          setIsStreaming(false);
          setStatusMessage("");
          setStreamingUserMessage("");
          setProcessingQuery(null);
        }

        currentPendingTempIdRef.current = null;
        isWatchingLoadingRef.current = false;
      },
      // onError callback
      (errorMsg) => {
        console.error("Message error:", errorMsg);
        setErrorMessage("Trevi encountered an error — it's not your fault");
        setIsError(true);
        setIsLoading(false);
        // Keep isLoadingTransition true to show error screen if still watching
        if (!isWatchingLoadingRef.current) {
          setIsLoadingTransition(false);
        }
        setIsCreatingChat(false);
        setIsStreaming(false);
        setProcessingQuery(null);
        currentPendingTempIdRef.current = null;
        isWatchingLoadingRef.current = false;
      },
      isWatchingLoadingRef
    );
  }, [rootNodeId, startChatCreation, startBackgroundPolling]);

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

      // Start tracking this connection with chatId
      // Use the node ID as the key for ConnectionManager to show loading state on the node
      const abortController = connectionManagerRef.current.start(currentNodeId, message, currentChatId);

      // Persist follow-up request
      // We use a different key than 'exploring' to distinguish, but the pattern is identical
      localStorage.setItem(`trevi-followup-${currentChatId}`, JSON.stringify({ nodeId: currentNodeId, message }));

      await sendMessage(
        request,
        (update) => {
          setStatusMessage(update.message);
          setNodeStatusMessage(update.message);
        },
        (event) => {
          // Mark connection as complete
          connectionManagerRef.current.complete(currentNodeId);
          localStorage.removeItem(`trevi-followup-${currentChatId}`);

          getGraph(event.chat_id)
            .then((graphResponse) => {
              const { nodes } = buildGraphNodesFromResponse(graphResponse);

              // SAFETY: Ensure the new node exists in the graph (optimistic update if backend is lagging)
              if (!nodes.find(n => n.id === event.node_id)) {
                console.warn("New node missing from graph fetch (sidebar follow-up), patching locally:", event.node_id);
                // Patch conversation node
                nodes.push({
                  id: event.node_id,
                  label: event.label,
                  summary: event.summary,
                  parentId: event.parent_node_id === "root" ? null : event.parent_node_id,
                  isDirection: false,
                  payload: event.payload,
                  citations: event.citations,
                });

                // Patch direction nodes from event
                if (event.direction_nodes) {
                  event.direction_nodes.forEach(dn => {
                    if (!nodes.find(n => n.id === dn.node_id)) {
                      nodes.push({
                        id: dn.node_id,
                        label: dn.label,
                        summary: dn.summary,
                        parentId: event.node_id,
                        isDirection: true,
                      });
                    }
                  });
                }
              }

              // STRICT DEDUPLICATION: Ensure no duplicate IDs exist
              const uniqueNodes = Array.from(
                new Map(nodes.map(node => [node.id, node])).values()
              );

              setGraphNodes(uniqueNodes);

              // CRITICAL: Use the current node from the API response as the source of truth
              if (graphResponse.current_node) {
                setCurrentNodeId(graphResponse.current_node);
              } else {
                setCurrentNodeId(event.node_id);
              }

              // Update unread nodes with the confirmed current node
              const unreadId = graphResponse.current_node || event.node_id;
              setUnreadNodeIds(new Set([unreadId]));
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
          connectionManagerRef.current.error(currentNodeId, error.error || 'Failed to send follow-up');
          localStorage.removeItem(`trevi-followup-${currentChatId}`);

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
      setErrorMessage("Trevi encountered an error — it's not your fault");
      setIsError(true);
      setIsLoading(false);
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
      setIsError(true);
      setErrorMessage("Failed to edit message");
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
    setIsError(false); // Clear previous error
    setErrorMessage("");

    try {
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
    } catch (error) {
      console.error("Failed to delete node:", error);
      setIsError(true);
      setErrorMessage("Failed to delete node");
    }
  }, [currentChatId, loadingNodeIds, isStreaming, isLoading]);

  // Handle selecting a chat from left sidebar
  const handleChatSelect = useCallback(async (chatId: string) => {
    // Mark that we're no longer watching the loading screen (if a chat was being created)
    isWatchingLoadingRef.current = false;
    setIsLoadingTransition(false);
    setIsCreatingChat(false); // Important: clear this so loading screen goes away

    // Close chat sidebar when selecting a different chat - REMOVED to keep/open it
    // setIsChatSidebarOpen(false);
    setIsLoading(true);
    setCurrentChatId(chatId);
    currentChatIdRef.current = chatId; // Sync ref immediately
    setIsError(false); // Clear previous error
    setErrorMessage("");

    // Clear ALL streaming/status states immediately to prevent bleeding
    setIsStreaming(false);
    setIsNodeStreaming(false);
    setStatusMessage("Loading conversation...");
    setNodeStatusMessage("");
    setProcessingQuery(null);
    setStreamingUserMessage("");
    setNodeStreamingUserMessage("");

    // On mobile, default to chat tab when opening a chat
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileActiveTab('chat');
    }

    try {
      const graphResponse = await getGraph(chatId);
      const { nodes, currentNodeId: nodeId, rootNodeId: root } = buildGraphNodesFromResponse(graphResponse);

      setGraphNodes(nodes);

      // Restore active node from localStorage if available, otherwise use API's current_node
      const savedNodeId = localStorage.getItem(`trevi-active-node-${chatId}`);
      const activeNodeId = savedNodeId && nodes.some(n => n.id === savedNodeId) ? savedNodeId : nodeId;
      setCurrentNodeId(activeNodeId);

      // Auto-open sidebar when selecting a chat to show the conversation
      setIsChatSidebarOpen(true);

      setRootNodeId(root);
      setResponses([]);

      // Restore exploration status if this chat has active connections
      const activeNodes = connectionManagerRef.current.getActiveNodeIds(chatId);
      if (activeNodes.size > 0) {
        const activeLabels = Array.from(activeNodes)
          .map(id => nodes.find(n => n.id === id)?.label)
          .filter((label): label is string => !!label);
        if (activeLabels.length > 0) {
          setStatusMessage(activeLabels[0] || "Exploring...");
          setIsStreaming(true);
        } else {
          setStatusMessage("");
        }
      } else {
        setStatusMessage("");
        setIsStreaming(false);
      }
    } catch (error) {
      console.error("Failed to load chat graph:", error);
      setStatusMessage("Failed to load conversation");
      setGraphNodes([]);
      setCurrentNodeId(null);
      setRootNodeId(null);
      setIsError(true);
      setErrorMessage("Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  }, [unreadNodeIds]); // Add unreadNodeIds as dependency if needed, though strictly not needed for this callback

  // Resume exploration if there was one pending for this chat
  useEffect(() => {
    if (!currentChatId || isLoading) return;

    const savedExploration = localStorage.getItem(`trevi-exploring-${currentChatId}`);
    if (savedExploration) {
      try {
        const { nodeId, nodeLabel } = JSON.parse(savedExploration);
        console.log("Resuming exploration for:", nodeId, nodeLabel);

        // Check if already exploring (e.g. from fast switching)
        if (connectionManagerRef.current.isLoading(nodeId, currentChatId)) return;

        // Restore UI state
        const abortController = connectionManagerRef.current.start(nodeId, nodeLabel, currentChatId);
        setIsStreaming(true);
        setStatusMessage(nodeLabel);
        setProcessingQuery(nodeLabel);
        setStreamingUserMessage(`|-> Explore - '${nodeLabel}'...`); // Simplified resumption message
        setIsChatSidebarOpen(true);

        // Call pollForCompletion instead of sendMessage
        pollForCompletion(
          currentChatId,
          (update) => {
            if (currentChatIdRef.current !== currentChatId) return;
            if (connectionManagerRef.current.getActiveCount(currentChatId) === 1) {
              setStatusMessage(update.message);
            }
          },
          (event) => {
            // Mark connection as complete
            connectionManagerRef.current.complete(nodeId);
            localStorage.removeItem(`trevi-exploring-${currentChatId}`);

            if (currentChatIdRef.current !== currentChatId) return;

            // Mark as UNREAD
            setUnreadNodeIds(new Set([event.node_id]));

            getGraph(event.chat_id)
              .then((graphResponse) => {
                if (currentChatIdRef.current !== currentChatId) return;
                const { nodes } = buildGraphNodesFromResponse(graphResponse);

                // SAFETY: Ensure the new node exists
                if (!nodes.find(n => n.id === event.node_id)) {
                  nodes.push({
                    id: event.node_id,
                    label: event.label,
                    summary: event.summary,
                    parentId: event.parent_node_id === "root" ? null : event.parent_node_id,
                    isDirection: false,
                    payload: event.payload,
                    citations: event.citations,
                  });
                }

                const uniqueNodes = Array.from(new Map(nodes.map(node => [node.id, node])).values());
                setGraphNodes(uniqueNodes);

                if (graphResponse.current_node) {
                  setCurrentNodeId(graphResponse.current_node);
                } else {
                  setCurrentNodeId(event.node_id);
                }
              })
              .catch((fetchError) => {
                console.error("Failed to refresh graph resume:", fetchError);
                if (currentChatIdRef.current === currentChatId) setIsError(true);
              })
              .finally(() => {
                if (currentChatIdRef.current !== currentChatId) return;
                if (connectionManagerRef.current.getActiveCount(currentChatId) === 0) {
                  setStatusMessage("");
                  setProcessingQuery(null);
                  setStreamingUserMessage("");
                  setIsStreaming(false);
                }
              });
          },
          (error) => {
            console.error("Resume error:", error);
            connectionManagerRef.current.error(nodeId, error.error || 'Failed to resume exploration');
            localStorage.removeItem(`trevi-exploring-${currentChatId}`);

            if (currentChatIdRef.current === currentChatId) {
              setIsError(true);
              setErrorMessage(`Error resuming exploration: ${error.error}`);
              setIsStreaming(false);
              setProcessingQuery(null);
            }
          },
          { signal: abortController.signal }
        ).catch(e => {
          // Check for abort - if aborted (navigated away), KEEP the persistence so we can resume later
          if (e.message === 'Aborted' || e.name === 'AbortError') {
            console.log("Resumption aborted (navigation), keeping state");
            connectionManagerRef.current.complete(nodeId);
            return;
          }

          console.error("Poll catch:", e);
          localStorage.removeItem(`trevi-exploring-${currentChatId}`);
          connectionManagerRef.current.complete(nodeId); // Clean up manager

          if (currentChatIdRef.current === currentChatId) {
            setIsStreaming(false);
            setProcessingQuery(null);
          }
        });

      } catch (e) {
        console.error("Failed to parse saved exploration:", e);
        localStorage.removeItem(`trevi-exploring-${currentChatId}`);
      }
    }
  }, [currentChatId, isLoading]);

  // Resume follow-up if there was one pending for this chat
  useEffect(() => {
    if (!currentChatId || isLoading) return;

    const savedFollowUp = localStorage.getItem(`trevi-followup-${currentChatId}`);
    if (savedFollowUp) {
      try {
        const { nodeId, message } = JSON.parse(savedFollowUp);
        console.log("Resuming follow-up for:", nodeId);

        // Check if already exploring
        if (connectionManagerRef.current.isLoading(nodeId, currentChatId)) return;

        // Restore UI state
        // We use the node ID so the visual effect appears on the node
        const abortController = connectionManagerRef.current.start(nodeId, message, currentChatId);

        setIsStreaming(true);
        setStatusMessage(message);
        setProcessingQuery(message);
        setStreamingUserMessage(message);
        setIsNodeStreaming(true);
        setNodeStatusMessage(message);
        setNodeStreamingUserMessage(message);

        // Auto-open sidebar
        setIsChatSidebarOpen(true);

        // Call pollForCompletion
        pollForCompletion(
          currentChatId,
          (update) => {
            if (currentChatIdRef.current !== currentChatId) return;
            if (connectionManagerRef.current.getActiveCount(currentChatId) === 1) {
              setStatusMessage(update.message);
              setNodeStatusMessage(update.message);
            }
          },
          (event) => {
            // Mark connection as complete
            connectionManagerRef.current.complete(nodeId);
            localStorage.removeItem(`trevi-followup-${currentChatId}`);

            if (currentChatIdRef.current !== currentChatId) return;

            // Mark as UNREAD if it's a new node (though follow-ups often return same or new child)
            setUnreadNodeIds(new Set([event.node_id]));

            getGraph(event.chat_id)
              .then((graphResponse) => {
                if (currentChatIdRef.current !== currentChatId) return;
                const { nodes } = buildGraphNodesFromResponse(graphResponse);

                // SAFETY: Ensure node exists
                if (!nodes.find(n => n.id === event.node_id)) {
                  nodes.push({
                    id: event.node_id,
                    label: event.label,
                    summary: event.summary,
                    parentId: event.parent_node_id === "root" ? null : event.parent_node_id,
                    isDirection: false,
                    payload: event.payload,
                    citations: event.citations,
                  });
                }

                const uniqueNodes = Array.from(new Map(nodes.map(node => [node.id, node])).values());
                setGraphNodes(uniqueNodes);

                if (graphResponse.current_node) {
                  setCurrentNodeId(graphResponse.current_node);
                } else {
                  setCurrentNodeId(event.node_id);
                }
              })
              .catch((fetchError) => {
                console.error("Failed to refresh graph resume (follow-up):", fetchError);
                if (currentChatIdRef.current === currentChatId) setIsError(true);
              })
              .finally(() => {
                if (currentChatIdRef.current !== currentChatId) return;
                if (connectionManagerRef.current.getActiveCount(currentChatId) === 0) {
                  setStatusMessage("");
                  setProcessingQuery(null);
                  setStreamingUserMessage("");
                  setIsStreaming(false);
                  setIsNodeStreaming(false);
                  setNodeStatusMessage("");
                  setNodeStreamingUserMessage("");
                }
              });
          },
          (error) => {
            console.error("Resume follow-up error:", error);
            connectionManagerRef.current.error(nodeId, error.error || 'Failed to resume follow-up');
            localStorage.removeItem(`trevi-followup-${currentChatId}`);

            if (currentChatIdRef.current === currentChatId) {
              setIsError(true);
              setErrorMessage(`Error resuming follow-up: ${error.error}`);
              setIsStreaming(false);
              setProcessingQuery(null);
              setIsNodeStreaming(false);
              setNodeStatusMessage("");
              setNodeStreamingUserMessage("");
            }
          },
          { signal: abortController.signal }
        ).catch(e => {
          if (e.message === 'Aborted' || e.name === 'AbortError') {
            console.log("Resumption aborted (navigation), keeping state");
            connectionManagerRef.current.complete(nodeId);
            return;
          }
          console.error("Poll catch:", e);
          localStorage.removeItem(`trevi-followup-${currentChatId}`);
          connectionManagerRef.current.complete(nodeId);
          if (currentChatIdRef.current === currentChatId) {
            setIsStreaming(false);
            setProcessingQuery(null);
          }
        });
      } catch (e) {
        console.error("Failed to parse saved follow-up:", e);
        localStorage.removeItem(`trevi-followup-${currentChatId}`);
      }
    }
  }, [currentChatId, isLoading]);

  // Handle clicking logo to go back to landing page
  const handleLogoClick = useCallback(() => {
    // Mark that we're no longer watching the loading screen
    isWatchingLoadingRef.current = false;

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
    setIsError(false);
    setErrorMessage("");
    // Clear loading transition immediately if navigating away
    setIsLoadingTransition(false);
  }, []);

  // Handle starting a new chat
  const handleNewChat = useCallback(() => {
    handleLogoClick();
  }, [handleLogoClick]);

  // Handle clicking a direction node to explore (chat-scoped)
  const handleDirectionClick = useCallback(async (nodeId: string) => {
    // Capture chatId at the start of the request for use in async callbacks
    const chatId = currentChatId;
    if (!chatId) return;

    // Check if this specific node is already loading for this chat
    if (connectionManagerRef.current.isLoading(nodeId, chatId)) return;

    // IMMEDIATE UPDATE: Set current node to the direction node to force path highlighting
    setCurrentNodeId(nodeId);

    // Get node and parent labels for formatted explore message
    const clickedNode = graphNodes.find(n => n.id === nodeId);
    const nodeLabel = clickedNode?.label || 'topic';
    const parentNode = clickedNode?.parentId ? graphNodes.find(n => n.id === clickedNode.parentId) : null;
    const parentLabel = parentNode?.label || 'root';

    // Create formatted explore message
    const exploreMessage = `|-> Explore - '${nodeLabel}' in relation to - '${parentLabel}'`;

    // Start tracking this connection with chatId
    const abortController = connectionManagerRef.current.start(nodeId, nodeLabel, chatId);
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
    setIsError(false); // Clear previous error
    setErrorMessage("");

    // Persist exploration request
    localStorage.setItem(`trevi-exploring-${chatId}`, JSON.stringify({ nodeId, nodeLabel }));

    try {
      const request = createDirectedQueryRequest(chatId, nodeId);

      await sendMessage(
        request,
        (update) => {
          // Only update status if this is still the active chat
          if (currentChatIdRef.current !== chatId) return;
          // Only update status if this is the only active connection for this chat
          if (connectionManagerRef.current.getActiveCount(chatId) === 1) {
            setStatusMessage(update.message);
          }
        },
        (event) => {
          // Mark connection as complete
          connectionManagerRef.current.complete(nodeId);
          localStorage.removeItem(`trevi-exploring-${chatId}`);

          // Only update UI if this is still the active chat
          if (currentChatIdRef.current !== chatId) {
            // Background exploration completed - user switched away
            // Still mark as unread so they see it when they return
            // We can't update state directly if component unmounted/switched context easily, 
            // but we can update localStorage directly for that chat
            const unreadSet = new Set([event.node_id]);
            localStorage.setItem(`trevi-unread-${chatId}`, JSON.stringify(Array.from(unreadSet)));
            return;
          }

          // Current chat is active - update state
          // Current chat is active - update state
          // We will update unread status after fetching the graph to be precise with current_node


          getGraph(event.chat_id)
            .then((graphResponse) => {
              // Double-check we're still on the same chat
              if (currentChatIdRef.current !== chatId) return;
              const { nodes } = buildGraphNodesFromResponse(graphResponse);

              // SAFETY: Ensure the new node exists in the graph (optimistic update if backend is lagging)
              if (!nodes.find(n => n.id === event.node_id)) {
                console.warn("New node missing from graph fetch, patching locally:", event.node_id);
                // Patch conversation node
                nodes.push({
                  id: event.node_id,
                  label: event.label,
                  summary: event.summary,
                  parentId: event.parent_node_id === "root" ? null : event.parent_node_id,
                  isDirection: false, // It's a verified explored node now
                  payload: event.payload,
                  citations: event.citations,
                });

                // Patch direction nodes from event
                if (event.direction_nodes) {
                  event.direction_nodes.forEach(dn => {
                    // Avoid duplicates if they somehow exist
                    if (!nodes.find(n => n.id === dn.node_id)) {
                      nodes.push({
                        id: dn.node_id,
                        label: dn.label,
                        summary: dn.summary,
                        parentId: event.node_id, // Parent is the new node
                        isDirection: true,
                      });
                    }
                  });
                }
              }

              // STRICT DEDUPLICATION: Ensure no duplicate IDs exist
              // ReactFlow throws errors if multiple nodes share the same ID
              const uniqueNodes = Array.from(
                new Map(nodes.map(node => [node.id, node])).values()
              );

              setGraphNodes(uniqueNodes);

              // CRITICAL: Use the current node from the API response as the source of truth
              // This ensures we select exactly what the backend considers the active node
              if (graphResponse.current_node) {
                setCurrentNodeId(graphResponse.current_node);
              } else {
                // Fallback to event node if API doesn't return it (shouldn't happen)
                setCurrentNodeId(event.node_id);
              }

              // Update unread nodes with the confirmed current node
              const unreadId = graphResponse.current_node || event.node_id;
              setUnreadNodeIds(new Set([unreadId]));
            })
            .catch((fetchError) => {
              // Only show error if still on same chat
              if (currentChatIdRef.current !== chatId) return;
              console.error("Failed to refresh graph:", fetchError);
              const newResponses = [...responsesRef.current, event];
              responsesRef.current = newResponses;
              setResponses(newResponses);
              setGraphNodes(buildGraphFromResponses(newResponses));
              // Also update current node on fallback
              setCurrentNodeId(event.node_id);
              setIsError(true);
              setErrorMessage("Failed to refresh graph after exploration");
            })
            .finally(() => {
              // Only update status if still on same chat
              if (currentChatIdRef.current !== chatId) return;
              // Clear status if no more active connections for this chat
              if (connectionManagerRef.current.getActiveCount(chatId) === 0) {
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
          localStorage.removeItem(`trevi-exploring-${chatId}`);

          // Only update UI if still on same chat
          if (currentChatIdRef.current !== chatId) return;
          if (currentChatIdRef.current !== chatId) return;

          setIsError(true);
          setErrorMessage(`Error exploring: ${error.error}`);

          if (connectionManagerRef.current.getActiveCount(chatId) === 0) {
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

        // Only update UI if still on same chat
        if (currentChatIdRef.current === chatId) {
          setIsError(true);
          setErrorMessage(`Failed to explore: ${errorMessage}`);
        }
      }

      // Only update UI if still on same chat
      if (currentChatIdRef.current === chatId && connectionManagerRef.current.getActiveCount(chatId) === 0) {
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
    // Remove from unread list
    setUnreadNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      }
      return next;
    });
    // Auto-open sidebar when clicking on a node
    setIsChatSidebarOpen(true);
  }, []);

  // Handle sending a message from node conversation panel (uses query mode)
  const handleNodeMessage = useCallback(async (nodeId: string, message: string) => {
    if (!currentChatId || isNodeStreaming) return;

    // IMMEDIATE UPDATE: Set current node to query node to force path highlighting
    setCurrentNodeId(nodeId);

    setIsNodeStreaming(true);
    setNodeStatusMessage(message);
    setProcessingQuery(message);
    // Sync with sidebar streaming state
    setIsStreaming(true);
    setStatusMessage(message);
    setIsError(false); // Clear previous error
    setErrorMessage("");

    try {
      const request = createFollowUpRequest(message, currentChatId, nodeId);

      // Start tracking connection
      const abortController = connectionManagerRef.current.start(nodeId, message, currentChatId);

      // Persist follow-up
      localStorage.setItem(`trevi-followup-${currentChatId}`, JSON.stringify({ nodeId, message }));

      await sendMessage(
        request,
        (update) => {
          setNodeStatusMessage(update.message);
          setStatusMessage(update.message);
        },
        (event) => {
          // Complete connection tracking
          connectionManagerRef.current.complete(nodeId);
          localStorage.removeItem(`trevi-followup-${currentChatId}`);

          // Refresh graph to get updated data
          getGraph(event.chat_id)
            .then((graphResponse) => {
              const { nodes } = buildGraphNodesFromResponse(graphResponse);

              // SAFETY: Ensure the new node exists in the graph (optimistic update if backend is lagging)
              if (!nodes.find(n => n.id === event.node_id)) {
                console.warn("New node missing from graph fetch (follow-up), patching locally:", event.node_id);
                // Patch conversation node
                nodes.push({
                  id: event.node_id,
                  label: event.label,
                  summary: event.summary,
                  parentId: event.parent_node_id === "root" ? null : event.parent_node_id,
                  isDirection: false,
                  payload: event.payload,
                  citations: event.citations,
                });

                // Patch direction nodes from event
                if (event.direction_nodes) {
                  event.direction_nodes.forEach(dn => {
                    if (!nodes.find(n => n.id === dn.node_id)) {
                      nodes.push({
                        id: dn.node_id,
                        label: dn.label,
                        summary: dn.summary,
                        parentId: event.node_id,
                        isDirection: true,
                      });
                    }
                  });
                }
              }

              // STRICT DEDUPLICATION: Ensure no duplicate IDs exist
              const uniqueNodes = Array.from(
                new Map(nodes.map(node => [node.id, node])).values()
              );

              setGraphNodes(uniqueNodes);

              // CRITICAL: Use the current node from the API response as the source of truth
              if (graphResponse.current_node) {
                setCurrentNodeId(graphResponse.current_node);
              } else {
                setCurrentNodeId(event.node_id);
              }

              // Update unread nodes with the confirmed current node
              const unreadId = graphResponse.current_node || event.node_id;
              setUnreadNodeIds(new Set([unreadId]));
            })
            .catch((err) => {
              console.error("Failed to refresh graph:", err);
              // Fallback to local update if fetch fails
              const newResponses = [...responsesRef.current, event];
              responsesRef.current = newResponses;
              setResponses(newResponses);
              setGraphNodes(buildGraphFromResponses(newResponses));
              // Also update current node on fallback
              setCurrentNodeId(event.node_id);
            })

          setIsNodeStreaming(false);
          setNodeStatusMessage("");
          setProcessingQuery(null);
          // Also clear sidebar streaming state
          setIsStreaming(false);
          setStatusMessage("");
        },
        (error) => {
          console.error("Node message error:", error);
          connectionManagerRef.current.error(nodeId, error.error || 'Failed to send node message');
          localStorage.removeItem(`trevi-followup-${currentChatId}`);

          setNodeStatusMessage(`Error: ${error.error}`);
          setIsNodeStreaming(false);
          setProcessingQuery(null);
          setIsStreaming(false);
          setStatusMessage("");
          setIsError(true);
          setErrorMessage(`Error: ${error.error}`);
        }
      );
    } catch (error) {
      console.error("Failed to send node message:", error);
      setNodeStatusMessage("Failed to send message");
      setIsNodeStreaming(false);
      setProcessingQuery(null);
      setIsStreaming(false);
      setStatusMessage("");
      setIsError(true);
      setErrorMessage("Failed to send message");
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

  // Handle loading screen transition complete
  const handleLoadingTransitionComplete = useCallback(() => {
    setIsLoadingTransition(false);

    if (isError) {
      // On error: reset to home page
      setIsError(false);
      setErrorMessage("");
      setCurrentChatId(null);
      setCurrentNodeId(null);
      setRootNodeId(null);
      setGraphNodes([]);
      setResponses([]);
      responsesRef.current = [];
    } else if (currentChatId) {
      // On success: open sidebar
      setIsChatSidebarOpen(true);

      // Fallback: if graph nodes is still empty, fetch the graph again
      // This handles race conditions where the graph fetch might have failed silently
      if (graphNodes.length === 0) {
        getGraph(currentChatId)
          .then((graphResponse) => {
            const { nodes, currentNodeId: nodeId, rootNodeId: root } = buildGraphNodesFromResponse(graphResponse);
            setGraphNodes(nodes);
            if (nodeId) setCurrentNodeId(nodeId);
            if (root) setRootNodeId(root);
          })
          .catch((error) => {
            console.error("Fallback graph fetch failed:", error);
          });
      }

      // Also refresh the chat list to ensure sidebar shows the new chat
      refreshChats();
    }
  }, [currentChatId, isError, graphNodes.length, refreshChats]);

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
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area - flexes to accommodate right sidebar */}
      <main className="flex-1 flex flex-col md:flex-row h-full relative overflow-hidden">
        {/* Mobile Tab Bar - bottom navigation */}
        {showGraphPage && (
          <>
            {/* Mobile Banner - only in graph view */}
            {mobileActiveTab === 'graph' && (
              <div className="fixed bottom-[73px] left-0 right-0 z-40 bg-yellow-100 border-t border-yellow-200 px-4 py-2.5 md:hidden">
                <p className="text-center text-xs font-medium text-yellow-900">
                  For Best Experience - Try Trevi on a Computer
                </p>
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex md:hidden">
              <button
                onClick={() => setMobileActiveTab('graph')}
                className={`flex-1 flex items-center justify-center gap-2 py-5 transition-colors ${mobileActiveTab === 'graph' ? 'text-blue-600' : 'text-slate-400'
                  }`}
              >
                <Network className="w-5 h-5" />
                <span className="text-sm font-medium">Tree</span>
              </button>
              <button
                onClick={() => { setMobileActiveTab('chat'); setIsChatSidebarOpen(true); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 transition-colors ${mobileActiveTab === 'chat' ? 'text-blue-600' : 'text-slate-400'
                  }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span className="text-sm font-medium">Chat</span>
              </button>
            </div>
          </>
        )}

        {/* Graph/Content Area */}
        <div className={`flex-1 h-full overflow-hidden relative ${showGraphPage && mobileActiveTab === 'graph' ? 'pb-[114px] md:pb-0' : showGraphPage ? 'pb-16 md:pb-0' : ''}`}>
          {showLoadingPage ? (
            <GraphLoading
              query={processingQuery || undefined}
              isFinished={!isCreatingChat && isLoadingTransition}
              isError={isError}
              errorMessage={errorMessage}
              onTransitionComplete={handleLoadingTransitionComplete}
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
                unreadNodeIds={unreadNodeIds}
                onToggleChatSidebar={toggleChatSidebar}
                isChatSidebarOpen={isChatSidebarOpen}
                initialActiveNodeId={currentNodeId}
                onNodeMessage={handleNodeMessage}
                isNodeStreaming={isNodeStreaming}
                nodeStatusMessage={nodeStatusMessage}
                nodeStreamUserMessage={nodeStreamingUserMessage}
                chatId={currentChatId || undefined}
                briefCache={briefCache}
                onBriefCacheUpdate={(nodeId, data) => {
                  setBriefCache(prev => new Map(prev).set(nodeId, data));
                }}
                skipLayoutAnimation={isLoading}
                isVisible={mobileActiveTab === 'graph'}
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
            briefCache={briefCache}
            onBriefCacheUpdate={(nodeId, data) => {
              setBriefCache(prev => new Map(prev).set(nodeId, data));
            }}
            graphNodes={graphNodes}
            onDirectionClick={handleDirectionClick}
            loadingNodeIds={loadingNodeIds}
          />
        </div>
      </main>
    </div>
  );
}

// Wrap HomeContent with ChatStoreProvider
export default function Home() {
  return (
    <ChatStoreProvider>
      <HomeContent />
    </ChatStoreProvider>
  );
}
