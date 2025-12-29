/**
 * API Configuration
 * 
 * Base URL for the Trevi backend API.
 * Change this value when deploying to different environments.
 */
export const API_BASE_URL = "/api";

/**
 * Default fetch options for all API calls.
 * - credentials: "include" ensures cookies are sent with requests
 */
const defaultOptions: RequestInit = {
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
};

// ============================================================================
// Types
// ============================================================================

export interface Chat {
  chat_id: string;
  chat_name: string;
  created_at: string;
}

export interface ChatsResponse {
  session_id: string;
  total: number;
  chats: Chat[];
}

/** Message modes for the /messages endpoint */
export type MessageMode = "query" | "directed_query" | "edit";

/** Request payload for sending a message */
export interface MessageRequest {
  message: string;
  parent_node_id?: string | null;
  mode?: MessageMode;
  chat_id?: string | null;
}

/** SSE Update event - shows processing status */
export interface UpdateEvent {
  node: string;
  message: string;
}

/** Direction node - suggested follow-up topics */
export interface DirectionNode {
  node_id: string;
  label: string;
  summary: string;
}

/** Citation occurrence in the response */
export interface CitationOccurrence {
  position: number;
  context: string;
  snippet: string;
}

/** Citation data */
export interface Citation {
  index: number;
  url: string;
  title: string;
  occurrences: CitationOccurrence[];
}

/** Message payload (user/assistant turn) */
export interface MessagePayload {
  role: "user" | "assistant";
  content: string;
}

/** SSE Complete event - full response data */
export interface CompleteEvent {
  session_id: string;
  chat_id: string;
  node_id: string;
  parent_node_id: string;
  payload: MessagePayload[];
  label: string;
  summary: string;
  references: string[];
  citations: Citation[];
  direction_nodes: DirectionNode[];
}

/** SSE Error event */
export interface ErrorEvent {
  error: string;
}

/** Graph node from /sessions/graph API */
export interface GraphNodeData {
  id: string;
  type: "root" | "conversation" | "direction";
  node_label: string;
  display_summary?: string;
  payload?: MessagePayload[];
  references?: string[];
  citations?: Citation[];
  timestamp?: string;
  editable?: boolean;
  is_topic_label?: boolean;
}

/** Graph edge from /sessions/graph API */
export interface GraphEdgeData {
  source: string;
  target: string;
}

/** Graph response from /sessions/graph API */
export interface GraphResponse {
  session_id: string;
  chat_id: string;
  graph: {
    nodes: GraphNodeData[];
    edges: GraphEdgeData[];
  };
  current_node: string;
}

/** Parsed SSE event */
export type SSEEvent =
  | { type: "update"; data: UpdateEvent }
  | { type: "complete"; data: CompleteEvent }
  | { type: "error"; data: ErrorEvent };

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches all chats for the current session.
 * Session is auto-created by backend if missing from cookie.
 * 
 * @example
 * const { chats, session_id } = await getChats();
 */
export async function getChats(): Promise<ChatsResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/chats`, {
    ...defaultOptions,
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches the complete conversation graph for a chat.
 * 
 * @param chatId - The chat ID to fetch the graph for
 * @returns The graph response with nodes and current node
 * 
 * @example
 * const { graph, current_node } = await getGraph("chat-uuid-xyz");
 */
export async function getGraph(chatId: string): Promise<GraphResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/graph`, {
    ...defaultOptions,
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ chat_id: chatId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch graph: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Converts GraphResponse into GraphNode array for the KnowledgeGraph component.
 */
export function buildGraphNodesFromResponse(graphResponse: GraphResponse): {
  nodes: Array<{ id: string; label: string; summary?: string; parentId: string | null; isDirection?: boolean }>;
  currentNodeId: string;
  rootNodeId: string | null;
} {
  const nodes: Array<{ id: string; label: string; summary?: string; parentId: string | null; isDirection?: boolean }> = [];
  let rootNodeId: string | null = null;

  // Build a map of node ID to parent ID from edges
  const parentMap = new Map<string, string>();
  graphResponse.graph.edges.forEach((edge) => {
    parentMap.set(edge.target, edge.source);
  });

  // Convert graph nodes array
  graphResponse.graph.nodes.forEach((nodeData) => {
    // Skip the root node itself (type: "root")
    if (nodeData.type === "root") {
      return;
    }

    const parentId = parentMap.get(nodeData.id) || null;
    
    nodes.push({
      id: nodeData.id,
      label: nodeData.node_label,
      summary: nodeData.display_summary,
      parentId: parentId === "root" ? null : parentId,
      isDirection: nodeData.type === "direction",
    });

    // Find root node (parent is "root" or no parent)
    if (parentId === "root" || !parentId) {
      rootNodeId = nodeData.id;
    }
  });

  return {
    nodes,
    currentNodeId: graphResponse.current_node,
    rootNodeId,
  };
}

// ============================================================================
// Messages API - Modular Request Builders
// ============================================================================

/**
 * Creates a new chat with an initial message.
 * 
 * @example
 * const request = createNewChatRequest("What is philosophy?");
 */
export function createNewChatRequest(message: string): MessageRequest {
  return {
    message,
    mode: "query",
    parent_node_id: null,
    chat_id: null,
  };
}

/**
 * Continues an existing chat with a follow-up message.
 * 
 * @example
 * const request = createFollowUpRequest("Tell me more", "chat-123", "node-456");
 */
export function createFollowUpRequest(
  message: string,
  chatId: string,
  parentNodeId: string
): MessageRequest {
  return {
    message,
    mode: "query",
    chat_id: chatId,
    parent_node_id: parentNodeId,
  };
}

/**
 * Follows a direction node (suggested topic).
 * 
 * @example
 * const request = createDirectedQueryRequest("chat-123", "direction-node-id");
 */
export function createDirectedQueryRequest(
  chatId: string,
  parentNodeId: string
): MessageRequest {
  return {
    message: "",
    mode: "directed_query",
    chat_id: chatId,
    parent_node_id: parentNodeId,
  };
}

/**
 * Edits an existing node with a new message.
 * 
 * @example
 * const request = createEditRequest("New question", "chat-123", "node-to-edit");
 */
export function createEditRequest(
  message: string,
  chatId: string,
  parentNodeId: string
): MessageRequest {
  return {
    message,
    mode: "edit",
    chat_id: chatId,
    parent_node_id: parentNodeId,
  };
}

/**
 * Sends a message and streams SSE responses.
 * 
 * @param request - Message request payload
 * @param onUpdate - Callback for update events (processing status)
 * @param onComplete - Callback for complete event (final response)
 * @param onError - Callback for error events
 * 
 * @example
 * await sendMessage(
 *   createNewChatRequest("What is philosophy?"),
 *   (update) => console.log(update.message),
 *   (complete) => console.log("Done:", complete.chat_id),
 *   (error) => console.error(error)
 * );
 */
export async function sendMessage(
  request: MessageRequest,
  onUpdate?: (event: UpdateEvent) => void,
  onComplete?: (event: CompleteEvent) => void,
  onError?: (event: ErrorEvent) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/messages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    onError?.({ error: errorText });
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processEvent = (eventType: string, data: string) => {
    try {
      const parsed = JSON.parse(data);
      console.log(`SSE Event [${eventType}]:`, parsed);
      
      switch (eventType) {
        case "update":
          onUpdate?.(parsed as UpdateEvent);
          break;
        case "complete":
          onComplete?.(parsed as CompleteEvent);
          break;
        case "error":
          onError?.(parsed as ErrorEvent);
          break;
        default:
          console.log(`Unknown SSE event type: ${eventType}`);
      }
    } catch (e) {
      console.error("Failed to parse SSE data:", e, "Raw data:", data);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log("SSE stream ended. Remaining buffer:", buffer);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    
    // Process complete SSE messages (separated by double newlines)
    const messages = buffer.split("\n\n");
    buffer = messages.pop() || ""; // Keep incomplete message in buffer

    for (const message of messages) {
      if (!message.trim()) continue;
      
      let eventType = "";
      let eventData = "";
      
      const lines = message.split("\n");
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          eventData = line.slice(5).trim();
        }
      }
      
      if (eventType && eventData) {
        processEvent(eventType, eventData);
      }
    }
  }
  
  // Process any remaining data in buffer after stream ends
  if (buffer.trim()) {
    console.log("Processing remaining buffer after stream end:", buffer);
    let eventType = "";
    let eventData = "";
    
    const lines = buffer.split("\n");
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        eventData = line.slice(5).trim();
      }
    }
    
    if (eventType && eventData) {
      processEvent(eventType, eventData);
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Formats a date string into a relative time string.
 * 
 * @param dateString - ISO date string (e.g., "2025-12-26T15:39:37.416638")
 * @returns Relative time string (e.g., "2 mins ago", "1 hour ago", "Yesterday")
 * 
 * @example
 * formatRelativeTime("2025-12-26T15:39:37.416638") // "5 mins ago"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString();
}
