"use client";

import React, { useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatInterface } from '@/components/chat/chat-interface';
import { KnowledgeGraph, GraphNode, buildGraphFromResponses } from '@/components/graph/knowledge-graph';
import { GraphLoading } from '@/components/loading/graph-loading';
import {
  sendMessage,
  createNewChatRequest,
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
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Handle sending a message from the landing page (always creates a new chat)
  const handleSendMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    setIsCreatingChat(true);
    setStatusMessage("Connecting...");

    try {
      // Landing page always creates a new chat
      const request = createNewChatRequest(message);

      // Send message with SSE streaming
      await sendMessage(
        request,
        // onUpdate callback
        (update) => {
          setStatusMessage(update.message);
        },
        // onComplete callback
        (event) => {
          // Update chat state
          setCurrentChatId(event.chat_id);
          setCurrentNodeId(event.node_id);
          
          // Set root node if this is first response
          if (!rootNodeId) {
            setRootNodeId(event.node_id);
          }
          
          // Add to responses and rebuild graph
          setResponses(prev => {
            const newResponses = [...prev, event];
            const nodes = buildGraphFromResponses(newResponses);
            setGraphNodes(nodes);
            return newResponses;
          });
          
          setStatusMessage("");
          setIsLoading(false);
          setIsCreatingChat(false);
        },
        // onError callback
        (error) => {
          console.error("Message error:", error);
          setStatusMessage(`Error: ${error.error}`);
          setIsLoading(false);
          setIsCreatingChat(false);
        }
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      setStatusMessage("Failed to send message");
      setIsLoading(false);
      setIsCreatingChat(false);
    }
  }, [rootNodeId]);

  // Handle selecting a chat from sidebar
  const handleChatSelect = useCallback(async (chatId: string) => {
    setIsLoading(true);
    setStatusMessage("Loading conversation...");
    setCurrentChatId(chatId);
    
    try {
      // Fetch the graph for this chat
      const graphResponse = await getGraph(chatId);
      const { nodes, currentNodeId, rootNodeId: root } = buildGraphNodesFromResponse(graphResponse);
      
      setGraphNodes(nodes);
      setCurrentNodeId(currentNodeId);
      setRootNodeId(root);
      setResponses([]); // Clear responses since we loaded from graph
      setStatusMessage("");
    } catch (error) {
      console.error("Failed to load chat graph:", error);
      setStatusMessage("Failed to load conversation");
      // Reset state on error
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
    setGraphNodes([]);
    setStatusMessage("");
    setIsLoading(false);
    setIsCreatingChat(false);
  }, []);

  // Handle starting a new chat
  const handleNewChat = useCallback(() => {
    handleLogoClick(); // Same behavior - go to landing
  }, [handleLogoClick]);

  // Handle clicking a node in the graph
  const handleNodeClick = useCallback((nodeId: string) => {
    setCurrentNodeId(nodeId);
  }, []);

  // Determine what to show: landing, loading, or graph view
  const showLandingPage = !currentChatId && !isCreatingChat;
  const showLoadingPage = isCreatingChat;
  const showGraphPage = currentChatId && graphNodes.length > 0 && !isCreatingChat;

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <Sidebar 
        selectedChatId={currentChatId}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
        onLogoClick={handleLogoClick}
      />
      
      <main className="flex-1 flex flex-col h-full relative">
        <div className="flex-1 h-full overflow-hidden">
          {showLoadingPage ? (
            <GraphLoading />
          ) : showGraphPage ? (
            <KnowledgeGraph 
              nodes={graphNodes}
              rootNodeId={rootNodeId || undefined}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <ChatInterface 
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              statusMessage={statusMessage}
            />
          )}
        </div>
      </main>
    </div>
  );
}
