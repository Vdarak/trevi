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

/** Bibliography response from /sessions/bibliography */
export interface BibliographyResponse {
  chat_id: string;
  reference_usage: Record<string, string[]>; // URL/Key -> Array of Node IDs
}

/** User metadata response from /sessions/user-metadata */
export interface UserMetadataResponse {
  has_user_info: boolean;
  email?: string;
  first_name?: string;
  last_name?: string;
  provided_at?: string;
}

/** User metadata request for POST /sessions/user-metadata */
export interface UserMetadataRequest {
  email: string;
  first_name: string;
  last_name: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches user metadata for the current session.
 * Used to check if user has provided their info for onboarding.
 * 
 * @returns User metadata with has_user_info flag
 * 
 * @example
 * const { has_user_info, email } = await getUserMetadata();
 * if (!has_user_info) redirect('/welcome');
 */
export async function getUserMetadata(): Promise<UserMetadataResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/user-metadata`, {
    ...defaultOptions,
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user metadata: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Stores user metadata in the current session.
 * Called after user completes onboarding form.
 * 
 * @param data - User's email and name
 * @returns Updated user metadata
 * 
 * @example
 * await setUserMetadata({ email: "user@example.com", first_name: "Jane", last_name: "Doe" });
 */
export async function setUserMetadata(data: UserMetadataRequest): Promise<UserMetadataResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/user-metadata`, {
    ...defaultOptions,
    method: "POST",
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to set user metadata: ${response.statusText}`);
  }

  return response.json();
}

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
 * Supports multiple root nodes (multiple independent graphs).
 */
export function buildGraphNodesFromResponse(graphResponse: GraphResponse): {
  nodes: Array<{ id: string; label: string; summary?: string; parentId: string | null; isDirection?: boolean; payload?: MessagePayload[]; citations?: Citation[] }>;
  currentNodeId: string;
  rootNodeId: string | null; // Primary root (first found) for backwards compatibility
  rootNodeIds: string[]; // All root nodes for multi-graph support
} {
  const nodes: Array<{ id: string; label: string; summary?: string; parentId: string | null; isDirection?: boolean; payload?: MessagePayload[]; citations?: Citation[] }> = [];
  const rootNodeIds: string[] = [];

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
      payload: nodeData.payload,
      citations: nodeData.citations,
    });

    // Collect all root nodes (parent is "root" or no parent)
    if (parentId === "root" || !parentId) {
      rootNodeIds.push(nodeData.id);
    }
  });

  return {
    nodes,
    currentNodeId: graphResponse.current_node,
    rootNodeId: rootNodeIds[0] || null, // Primary root for backwards compatibility
    rootNodeIds, // All roots for multi-graph support
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
  onError?: (event: ErrorEvent) => void,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/messages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: options?.signal,
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
// Chat & Node Management APIs
// ============================================================================

/**
 * Deletes a chat and all associated data permanently.
 * 
 * @param chatId - The chat ID to delete
 * 
 * @example
 * await deleteChat("chat-uuid-xyz");
 */
export async function deleteChat(chatId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/chat/delete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete chat: ${response.statusText}`);
  }
}

/** History response from /sessions/history API */
export interface HistoryResponse {
  session_id: string;
  chat_id: string;
  history: MessagePayload[];
  path: string[]; // node IDs from root to current
}

/**
 * Fetches conversation history from root to current node.
 * 
 * @param chatId - The chat ID to fetch history for
 * @returns History response with messages and path
 * 
 * @example
 * const { history, path } = await getHistory("chat-uuid-xyz");
 */
export async function getHistory(chatId: string): Promise<HistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/history`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }

  return response.json();
}

/** Response from node deletion API */
export interface DeleteNodeResponse {
  chat_id: string;
  session_id: string;
  deleted_node_id: string;
  deleted_count: number;
  current_node: string;
  graph: GraphResponse['graph'];
}

/**
 * Deletes a node and all its descendants, updating current_node to parent.
 * 
 * @param chatId - The chat ID
 * @param nodeId - The node ID to delete
 * @returns Updated graph with deleted count
 * 
 * @example
 * const result = await deleteNode("chat-123", "node-456");
 */
export async function deleteNode(chatId: string, nodeId: string): Promise<DeleteNodeResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/chat/delete/node`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, node_id: nodeId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete node: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================

/** Response from edit chat API */
export interface EditChatResponse {
  session_id: string;
  chat_id: string;
  node_id: string; // The NEW node ID created after edit
  payload: MessagePayload[];
}

/**
 * Edits a previous query and regenerates the response using classification-based placement.
 * 
 * @param chatId - The chat ID
 * @param nodeId - The node ID of the query to edit
 * @param newQuery - The new query text
 * @returns The response containing the new node ID and payload
 */
export async function editChatResponse(
  chatId: string,
  nodeId: string,
  newQuery: string
): Promise<EditChatResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/chat/edit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      node_id: nodeId,
      query: newQuery
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to edit chat response: ${response.statusText}`);
  }

  return response.json();
}

/** Bibliography response from /sessions/bibliography */
export interface BibliographyResponse {
  chat_id: string;
  reference_usage: Record<string, string[]>; // URL/Key -> Array of Node IDs
}

/**
 * Fetches the bibliography for a chat session.
 * 
 * @param chatId - The chat ID
 * @returns Bibliography data mapping references to node usage
 */
export async function getBibliography(chatId: string): Promise<BibliographyResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/bibliography`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch bibliography: ${response.statusText}`);
  }

  return response.json();
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
  // Backend returns UTC timestamps without 'Z' suffix, so we append it
  // to ensure JavaScript parses it as UTC rather than local time
  const normalizedDateString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
  const date = new Date(normalizedDateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future timestamps (negative diff) - show as "Just now"
  if (diffMs < 0) return "Just now";

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

// ============================================================================
// Feedback API
// ============================================================================

/** Feedback type - form (detailed) or quick (simple reaction) */
export type FeedbackType = "form" | "quick";

/** Feedback request for POST /sessions/feedback */
export interface FeedbackRequest {
  type: FeedbackType;
  content: Record<string, unknown>;
}

/** Feedback response from POST /sessions/feedback */
export interface FeedbackResponse {
  message: string;
  feedback_id: string;
}

/**
 * Submits user feedback for the current session.
 * Requires user metadata to be set.
 * 
 * @param type - "form" for detailed feedback, "quick" for simple reactions
 * @param content - Structured feedback data (questions as keys, answers as values)
 * @returns Feedback response with message and feedback_id
 * 
 * @example
 * await submitFeedback("form", {
 *   "layout_preference": "compact",
 *   "overall_usability": 4,
 *   "qualitative_feedback": "Great tool!"
 * });
 */
export async function submitFeedback(
  type: FeedbackType,
  content: Record<string, unknown>
): Promise<FeedbackResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/feedback`, {
    ...defaultOptions,
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ type, content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit feedback: ${response.statusText}`);
  }

  return response.json();
}
