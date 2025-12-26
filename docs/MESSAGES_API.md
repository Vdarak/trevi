# Messages API Documentation

## Overview

The `/messages` endpoint is the primary interface for chat interactions. It handles both **new chat creation** and **continuing existing conversations** with automatic session management via HTTP cookies.

**Key Features:**
- ✅ Cookie-based session management (automatic creation & validation)
- ✅ On-the-fly session and chat creation
- ✅ Server-Sent Events (SSE) streaming response
- ✅ Comprehensive audit logging
- ✅ Unified new/existing chat handling with validation

---

## Endpoint Specification

### Request

**URL:** `POST /messages`

**Headers:**
- `Content-Type: application/json`
- `Cookie: session_id=<uuid>` *(optional, auto-created if missing)*

**Request Body:**

```json
{
  "message": "string",                    // Required for new chat (non-empty)
  "parent_node_id": "string | null",      // Optional, must be null for new chat
  "mode": "query | directed_query | edit", // Optional, default "query", must be "query" for new chat
  "chat_id": "string | null"              // Optional, omit for new chat, provide for existing
}
```

**Field Descriptions:**

| Field             | Type | New Chat | Existing Chat | Description |
|-------            |------|----------|---------------|-------------|
| `message`         | string | **Required, non-empty** | Optional | User query for new chat; follow-up for existing chat; empty for directed_query mode |
| `parent_node_id`  | string | null | **Must be null/empty** | Optional | Null for new chat (uses root); provide for existing chat to continue from specific node |
| `mode`            | enum | **Must be "query"** | Optional | "query" (normal), "directed_query" (follow direction node), "edit" (re-run node) |
| `chat_id`         | string | **Omit** | Provide to continue existing chat | Chat identifier; omit to create new chat |

---

### Response

**Success (200 OK):** Server-Sent Events stream with three event types:

#### 1. Update Events

Sent during processing to provide status:

```
event: update
data: {"node": "retrieve", "message": "Searching documents..."}

event: update
data: {"node": "classify", "message": "Classifying response..."}
```

#### 2. Complete Event

Sent when processing finishes with full conversation data:

```
event: complete
data: {
  "session_id": "abc-123-def",
  "chat_id": "new-chat-id-xyz",
  "node_id": "conv_abc123",
  "parent_node_id": "root",
  "payload": [
    {"role": "user", "content": "What is philosophy?"},
    {"role": "assistant", "content": "Philosophy is the study of..."}
  ],
  "label": "Introduction to Philosophy",
  "summary": "Discussed fundamental concepts of philosophy",
  "references": ["https://example.com/philosophy", "..."],
  "citations": [
    {
      "index": 1,
      "url": "https://example.com/philosophy",
      "title": "Philosophy Overview",
      "occurrences": [...]
    }
  ],
  "direction_nodes": [
    {"id": "dir_xyz", "title": "Epistemology", "description": "Study of knowledge"},
    {...}
  ]
}
```

**Complete Event Fields:**
- `session_id`: Current session ID (matches cookie)
- `chat_id`: Chat ID (newly created for new chat)
- `node_id`: Conversation node created/updated in graph
- `parent_node_id`: Parent node in graph structure
- `payload`: User query and AI response
- `label`: Short title for this conversation turn
- `summary`: Display summary for UI
- `references`: URLs cited in response
- `citations`: Structured citation data with occurrences
- `direction_nodes`: New exploration directions offered

#### 3. Error Events

Sent on processing errors:

```
event: error
data: {"error": "Failed to retrieve relevant documents"}
```

---

## Scenarios & Examples

### Scenario 1: New Chat (First Message)

**Flow:**
1. User has no session cookie (or it's expired)
2. Frontend sends request with no `chat_id`
3. API auto-creates session (from expired/missing cookie)
4. API auto-creates chat under that session
5. API processes message and streams response
6. Response sets `session_id` cookie for future requests
7. Frontend extracts `chat_id` from complete event for use in subsequent messages

**Request:**

```bash
curl -X POST http://localhost:8000/messages \
  -H "Content-Type: application/json" \
  -d {
    "message": "What is philosophy?",
    "parent_node_id": null,
    "mode": "query",
    "chat_id": null
  }
```

**Response Headers:**
```
Set-Cookie: session_id=abc-123-uuid; Max-Age=86400; HttpOnly; Secure; SameSite=Lax
```

**Response Stream:**
```
event: update
data: {"node": "retrieve", "message": "Searching..."}

event: complete
data: {"session_id": "abc-123-uuid", "chat_id": "xyz-789-new", "node_id": "conv_1", ...}
```

**Frontend Next Steps:**
1. Store `chat_id` from complete event in localStorage/state
2. Browser automatically includes `session_id` cookie in next request
3. For follow-up message, send with this `chat_id`

---

### Scenario 2: Follow-up in Existing Chat

**Flow:**
1. User has `session_id` cookie (from previous conversation)
2. Frontend has `chat_id` stored (from previous complete event)
3. Frontend sends request with both cookie and `chat_id`
4. API validates session and chat exist
5. API processes message in existing conversation
6. Response streams normally

**Request:**

```bash
curl -X POST http://localhost:8000/messages \
  -H "Content-Type: application/json" \
  -b "session_id=abc-123-uuid" \
  -d {
    "message": "Tell me more about epistemology",
    "parent_node_id": "conv_1",
    "mode": "query",
    "chat_id": "xyz-789-new"
  }
```

**Response Stream:**
```
event: update // ( Streaming )
data: {"node": "retrieve", "message": "Searching..."}

event: complete
data: {"session_id": "abc-123-uuid", "chat_id": "xyz-789-new", "node_id": "conv_2", ...}
```

---

### Scenario 3: Directed Query (Follow Direction Node)

**Flow:**
1. User clicks on a "direction node" offered in previous response
2. Frontend sends with `mode: "directed_query"`, empty `message`
3. API auto-generates message or follows the direction
4. Otherwise same as follow-up

**Request:**

```bash
curl -X POST http://localhost:8000/messages \
  -H "Content-Type: application/json" \
  -b "session_id=abc-123-uuid" \
  -d {
    "message": "",
    "parent_node_id": "dir_xyz",
    "mode": "directed_query",
    "chat_id": "xyz-789-new"
  }
```

---

### Scenario 4: Edit & Re-run (Edit Mode)

**Flow:**
1. User modifies an earlier query
2. Frontend sends `mode: "edit"` with new message
3. API deletes subtree of edited node
4. API processes new query and reattaches
5. Conversation continues from new result

**Request:**

```bash
curl -X POST http://localhost:8000/messages \
  -H "Content-Type: application/json" \
  -b "session_id=abc-123-uuid" \
  -d {
    "message": "What is the relationship between ethics and epistemology?",
    "parent_node_id": "conv_1",
    "mode": "edit",
    "chat_id": "xyz-789-new"
  }
```

---

## Validation Rules

### For New Chat (`chat_id` omitted)

| Rule | Status | Error Code | Details |
|------|--------|-----------|---------|
| `message` must be non-empty | 400 | `INVALID_NEW_CHAT_REQUEST` | Cannot create chat without initial query |
| `parent_node_id` must be null/empty | 400 | `INVALID_NEW_CHAT_REQUEST` | New chats start from root node |
| `mode` must be "query" | 400 | `INVALID_NEW_CHAT_REQUEST` | Can only use normal query for new chat |

**Example Error Response:**

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "detail": "Message cannot be empty when creating a new chat"
}
```

### For Existing Chat (`chat_id` provided)

| Rule | Status | Error Code | Details |
|------|--------|-----------|---------|
| `chat_id` must exist in session | 404 | `CHAT_NOT_FOUND` | Chat not found in session or expired |
| `parent_node_id` (if provided) must exist in graph | 400 | `INVALID_PARENT_NODE` | Node doesn't exist in conversation graph |
| RAG system must initialize successfully | 500 | `RAG_INIT_FAILED` | Failed to load search/language models |

---

## Error Responses

**400 Bad Request** - Invalid input validation:
```json
{"detail": "Message cannot be empty when creating a new chat"}
{"detail": "parent_node_id must be empty for a new chat"}
{"detail": "mode must be 'query' when creating a new chat"}
{"detail": "Parent node parent-xyz not found in graph"}
```

**404 Not Found** - Resource not found:
```json
{"detail": "Chat xyz-789 not found in session"}
{"detail": "Graph not found for chat xyz-789"}
```

**500 Internal Server Error** - Server-side issues:
```json
{"detail": "Failed to initialize RAG system"}
{"detail": "Failed to initialize conversation orchestrator"}
{"detail": "Failed to create chat"}
```

**503 Service Unavailable** - Dependencies down:
```json
{"detail": "Session storage unavailable"}
```

---

## Cookie Management

### Session Cookie Details

| Property | Value | Notes |
|----------|-------|-------|
| **Name** | `session_id` | Standard HTTP cookie name |
| **Max-Age** | 86400 seconds (24 hours) | Matches Redis TTL; refresh on each request |
| **HttpOnly** | `true` | Not accessible to JavaScript (security) |
| **Secure** | `false` (dev) / `true` (prod) | Only over HTTPS in production |
| **SameSite** | `Lax` | CSRF protection; allows top-level navigation |
| **Domain** | Automatic | Set to request domain |
| **Path** | `/` | Available for all endpoints |

### Frontend Integration

**Using fetch() with credentials:**

```javascript
// Include credentials so browser automatically sends cookies
const response = await fetch('/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // CRITICAL: Include cookies in request
  body: JSON.stringify({
    message: "What is philosophy?",
    chat_id: null  // omit for new chat
  })
});
```

**Reading SSE stream:**

```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('event: complete')) {
      // Parse next line for JSON
      const data = JSON.parse(line.replace('data: ', ''));
      const chatId = data.chat_id;  // Extract for future requests
      localStorage.setItem('current_chat_id', chatId);
    }
  }
}
```

---

## Audit Logging

All session and chat lifecycle events are logged to `logs/audit.jsonl`:

| Event Type | Triggered | Fields |
|-----------|-----------|--------|
| `session_created` | New session auto-created | session_id, timestamp, source_endpoint |
| `session_validated` | Existing session validated | session_id, timestamp |
| `chat_auto_created` | Chat created in /messages | session_id, chat_id, user_message_preview, timestamp |
| `validation_error` | Request validation fails | session_id, chat_id (if applicable), error details, error code |

**Example Audit Entry:**

```json
{
  "timestamp": "2025-01-15T10:30:45.123456",
  "event_type": "chat_auto_created",
  "session_id": "abc-123-uuid",
  "chat_id": "xyz-789-new",
  "user_message_preview": "What is philosophy?",
  "source_endpoint": "/messages"
}
```

---

## Implementation Checklist for Frontend

- [ ] Configure fetch requests with `credentials: 'include'` for cookie handling
- [ ] Extract `chat_id` from first complete event and store in localStorage/state
- [ ] Pass `chat_id` in subsequent messages to the same conversation
- [ ] Omit `chat_id` for new conversations
- [ ] Handle SSE stream with EventSource or fetch streaming
- [ ] Implement retry logic for transient errors (500, 503)
- [ ] Display update events to user for transparency
- [ ] Extract complete event data for response display
- [ ] Handle error events gracefully
- [ ] Respect `max_age` cookie expiration (auto-refresh session)

---

## Deprecations

### Removed Endpoints

The following endpoints have been removed as session/chat creation is now automatic:

- ~~`POST /sessions`~~ → Replaced with auto-creation in `/messages`
- ~~`DELETE /sessions/{session_id}`~~ → Sessions expire automatically; use browser cookie deletion

### Kept Endpoints (for reference/cleanup)

- `GET /sessions` - List all active session IDs
- `GET /sessions/{session_id}/chats` - List chats in session
- `DELETE /sessions/{session_id}/chats/{chat_id}` - Manual chat deletion (if needed)
- `POST /sessions/{session_id}/chats/{chat_id}/messages` - **Old endpoint, use `/messages` instead**
- `PUT /sessions/{session_id}/chats/{chat_id}/edit_node` - Edit conversation node

**Note:** These old endpoints will be fully removed in a future version. Use `/messages` for all new chat interactions.

---

## Performance Considerations

- **Session creation:** ~5-10ms (Redis write)
- **Chat creation:** ~10-15ms (Redis write + graph initialization)
- **Message processing:** Variable (depends on RAG retrieval + LLM generation)
- **SSE overhead:** Minimal; streaming starts immediately

---

## List Chats API

### `GET /sessions/chats` - List all chats with auto-session creation

**Description:** Retrieve list of all chats in the current session. Automatically creates a new session if the session cookie is missing or expired.

**Request:**

```bash
curl -X GET http://localhost:8000/sessions/chats \
  -H "Cookie: session_id=abc-123-uuid"  # optional, auto-created if missing
```

**Response (200 OK):**

```json
{
  "session_id": "abc-123-uuid",
  "total": 2,
  "chats": [
    {
      "chat_id": "chat-001",
      "chat_name": "What is philosophy?",
      "created_at": "2025-01-15T10:30:45.123456"
    },
    {
      "chat_id": "chat-002",
      "chat_name": "Ethics and morality",
      "created_at": "2025-01-15T11:15:22.654321"
    }
  ]
}
```

**Response Headers:**
```
Set-Cookie: session_id=abc-123-uuid; Max-Age=86400; HttpOnly; Secure; SameSite=Lax
```

### Scenarios

#### Scenario 1: First-time user (no session cookie)

**Request:**
```bash
curl -X GET http://localhost:8000/sessions/chats
```

**Response:**
```json
{
  "session_id": "new-session-uuid",
  "total": 0,
  "chats": []
}
```

Browser receives `Set-Cookie` header → stores session_id for future requests.

#### Scenario 2: Returning user (session cookie exists)

**Request:**
```bash
curl -X GET http://localhost:8000/sessions/chats \
  -b "session_id=abc-123-uuid"
```

**Response:**
```json
{
  "session_id": "abc-123-uuid",
  "total": 2,
  "chats": [
    {"chat_id": "chat-001", "chat_name": "What is philosophy?", "created_at": "..."},
    {"chat_id": "chat-002", "chat_name": "Ethics and morality", "created_at": "..."}
  ]
}
```

### Frontend Integration

**Using JavaScript fetch:**

```javascript
// Get all chats for current session
const response = await fetch('/sessions/chats', {
  method: 'GET',
  credentials: 'include'  // Include cookies
});

const data = await response.json();
console.log(`Session: ${data.session_id}`);
console.log(`Available chats: ${data.total}`);

// Display chats
data.chats.forEach(chat => {
  console.log(`- ${chat.chat_name} (${chat.chat_id})`);
});

// Get latest chat_id for sending messages
const latestChat = data.chats[data.chats.length - 1];
if (latestChat) {
  localStorage.setItem('current_chat_id', latestChat.chat_id);
}
```

---

## Troubleshooting

### "Session storage unavailable" (503)

**Cause:** Redis connection failed

**Solution:**
1. Verify Redis is running: `redis-cli ping` → should return `PONG`
2. Check Redis URL in config: `REDIS_URL` environment variable
3. Check firewall/network access to Redis server

### "Chat not found in session" (404)

**Cause:** Chat doesn't exist or session expired

**Solution:**
1. Verify `chat_id` is correct (copy from previous complete event)
2. Verify `session_id` cookie is being sent (check browser DevTools)
3. If cookie expired, start new chat without `chat_id` parameter

### Message processing hangs or times out

**Cause:** RAG system or LLM taking too long

**Solution:**
1. Check logs for errors
2. Verify network connectivity to remote services
3. Increase timeout if needed (configuration)

### Cookies not persisting across requests

**Cause:** Frontend not including credentials in fetch

**Solution:**
1. Ensure fetch has `credentials: 'include'`
2. Check CORS configuration allows credentials
3. Verify `Secure` flag matches protocol (https vs http)

