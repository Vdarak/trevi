# Trevi: Project Evolution & Case Study

> A comprehensive development retrospective documenting the evolution of Trevi — a knowledge graph chat application built with Next.js, React Flow, and server-sent events.

---

## Executive Summary

**Trevi** is an AI-powered research and brainstorming tool that visualizes conversations as explorable knowledge graphs. This document chronicles the iterative development process, key technical decisions, and lessons learned throughout the project lifecycle.

| Aspect | Details |
|--------|---------|
| **Stack** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, React Flow |
| **Core Features** | SSE streaming, knowledge graph visualization, voice dictation |
| **Development Approach** | Iterative, user-feedback-driven |

---

## Project Goals

1. **Build a modern chat interface** with SSE-based real-time messaging
2. **Visualize conversations as knowledge graphs** using React Flow
3. **Enable exploration** via clickable direction nodes that expand the graph
4. **Deliver a polished UX** with smooth animations, voice input, and intuitive navigation

---

## Development Timeline

### Phase 1: Foundation & Scaffolding

**Initial Setup**
- Initialized Next.js app with TypeScript and Tailwind CSS
- Established design system (colors, typography, foundational components)
- Created UI primitives: `Button`, `Input`, `Card` components
- Fixed early Tailwind color configuration issues

**Key Deliverables:**
- Project structure with App Router
- CSS custom properties for theming
- Reusable component library (shadcn-style)

---

### Phase 2: Graph Integration

**React Flow Implementation**
- Integrated `@xyflow/react` for graph visualization
- Implemented dagre auto-layout for tree structure
- Disabled node dragging to maintain consistent layout
- Added dotted hover paths from any node back to root

**Technical Decisions:**
| Decision | Rationale |
|----------|-----------|
| Dagre layout | Deterministic tree layout, mindmap-like structure |
| Disable drag | Preserve layout consistency; use collapse/expand instead |
| Path highlighting | Visual context for node relationships |

---

### Phase 3: API Integration & SSE Streaming

**Messaging Architecture**
- Implemented `sendMessage()` with SSE parsing using `ReadableStream` + `TextDecoder`
- Created modular request builders for different interaction modes:
  - `createNewChatRequest()` — Initialize new conversations
  - `createFollowUpRequest()` — Continue existing chats
  - `createDirectedQueryRequest()` — Explore direction nodes
  - `createEditRequest()` — Re-run with modified queries

**SSE Event Handling:**
```
event: update → Live processing status
event: complete → Full response with graph updates
event: error → Error handling
```

**Cookie/Session Challenges:**
- Browser cookies require same-origin or CORS configuration
- **Solution:** Next.js rewrite proxy (`/api/:path*` → backend) to make requests same-origin
- Eliminated cross-origin cookie complexity during development

---

### Phase 4: Navigation & State Management

**Sidebar & Chat Selection**
- Implemented clickable logo navigation (return to landing)
- Added chat history list with relative timestamps
- Wired `onChatSelect`, `onLogoClick`, `onNewChat` handlers

**Page Orchestration:**
- Removed unnecessary view toggles
- Wired three-state UI: Landing → Loading → Graph View
- Integrated graph fetching on chat selection via `POST /sessions/graph`

---

### Phase 5: Graph Behavior & UX Polish

**Collapse/Expand System**
- Implemented node collapse with descendant hiding
- Added chevron toggle buttons on parent nodes
- Preserved progressive disclosure (minimal node content, tooltip for details)

**Hover Interactions:**
- Summary tooltip follows cursor (positioned below, centered)
- Edge highlighting with elevated z-index for visibility
- Animated stroke style on path-to-root

**Layout Improvements:**
- Tuned dagre parameters (`NODE_SEP`, `RANK_SEP`)
- Removed `align: "UL"` to center parents over children
- Prevented node overlap in dense graphs

---

### Phase 6: Advanced Layout System

**Dual Layout Algorithms**

1. **Custom Dendrogram Layout**
   - Computes subtree breadth using actual node widths
   - Two-tier spacing: tight siblings (`SIBLING_SEP`) + wide subtrees (`SUBTREE_SEP`)
   - Visual clustering that matches mental model of related concepts

2. **Tidy Tree Layout (D3-hierarchy)**
   - Reingold-Tilford algorithm for compact, balanced trees
   - Dynamic separation based on node widths
   - Well-known algorithm with predictable aesthetics

**Orientation Support:**
- Toggle between Top→Bottom and Left→Right directions
- Coordinate mapping handles breadth/depth swap for LR mode

**Dynamic Node Sizing:**
```typescript
function getNodeWidth(label: string): number {
  return Math.max(200, label.length * 10 + 80);
}
```
- Estimates width from label length
- Avoids costly DOM measurement
- All layout calculations use actual widths

---

### Phase 7: Animation System

**NotebookLM-Style Transitions**

Implemented `useLayoutAnimation` hook with:

| Feature | Behavior |
|---------|----------|
| **Sprout Animation** | New nodes emerge from parent position |
| **Fade-in** | Nodes start at 50% opacity, animate to 100% |
| **Exit Animation** | Collapsing nodes animate back to parent |
| **Fade-out** | Exiting nodes fade to 0% opacity |
| **Interrupt Handling** | New animations start from current in-flight positions |

**Animation Parameters:**
- Duration: 900ms
- Easing: Cubic ease-out (`1 - (1-t)³`)
- Frame-by-frame state updates via `requestAnimationFrame`

**Performance Optimizations:**
- Stationary-node short-circuit: skip updates when position delta < 0.1px
- Return identical object references for unchanged nodes
- Reduces React reconciliation overhead

---

### Phase 8: Node Conversation Panel & UX Refinements

**Native React Flow Conversation Panel**

Transformed the conversation panel from an externally positioned overlay to a first-class React Flow node:

| Feature | Implementation |
|---------|----------------|
| **Custom Node Type** | `ConversationPanelNode` renders as `type: 'conversationPanel'` |
| **Native Edge Connector** | Bezier curve edge from clicked node to panel |
| **Canvas Integration** | Panel pans and zooms with the graph naturally |
| **Animated Entrance** | Scale-in animation originating from parent node position |

**Technical Architecture:**
```typescript
// Panel created dynamically on node click
const panelNode: Node = {
  id: `panel-${node.id}`,
  type: 'conversationPanel',
  position: { x: node.position.x + nodeWidth + 50, y: node.position.y - 150 },
  data: { messages, label, onClose },
  zIndex: 9999, // Above hover highlighting
};
```

**Unified Horizontal Toolbar**

Consolidated all graph controls into a single toolbar:

```
[ + ][ - ][ ⊡ ] | [ ⎇ ][ ⎘ ] | [ ↓ ][ → ] | [ 💬 ]
 Zoom In/Out/Fit   Layout     Direction    Chat
```

- Replaced React Flow's built-in `<Controls>` with custom zoom buttons
- Added `zoomIn`, `zoomOut`, `fitView` from `useReactFlow()` hook
- Visual dividers separate control groups
- Consistent styling with active blue state on selection

**Markdown Rendering in Conversation**

Implemented `renderSimpleMarkdown()` for message display:
- **Bold** (`**text**`), *italic* (`*text*`)
- Inline `code` and code blocks
- Header formatting (##, ###)
- Bullet points and numbered lists
- Link display with underline styling

**Feedback Modal System**

Created multi-step UX survey at `components/feedback/feedback-modal.tsx`:

| Step | Content |
|------|---------|
| 1 | Layout preference (Spacious/Compact), Orientation preference (TB/LR) |
| 2 | Likert scales: Overall usability, Controls clarity, Navigation ease |
| 3 | Likert scales: Visual clarity, Learning effectiveness + qualitative feedback |
| 4 | Open-ended improvement suggestions |

- Replaced "ByeWind / Free Plan" in sidebar with feedback button
- Progress indicator, animated modal, success confirmation

**Global Style Improvements**

| Change | CSS Implementation |
|--------|-------------------|
| Hidden scrollbars | `scrollbar-width: none`, `::-webkit-scrollbar { display: none }` |
| Panel animation | `transform-origin: left center` for parent-node-based spawn |
| Edge styling | Solid blue (`#3b82f6`) instead of dashed gray |

**State Cleanup Improvements**

Fixed hover state persistence after closing conversation panel:
```typescript
onClose: () => {
  // Remove panel elements
  setNodes(nds => nds.filter(n => n.type !== 'conversationPanel'));
  setEdges(eds => eds.filter(e => !e.id.startsWith('panel-edge-')));
  // Clear hover state
  setHoveredNodeId(null);
  // Reset node highlighting
  setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isHighlighted: false } })));
  // Reset edge styling
  setEdges(eds => eds.map(e => ({ ...e, style: { stroke: "#94a3b8", strokeWidth: 2 }, animated: false, zIndex: 0 })));
};
```

**Canvas Zoom Limits**
- Extended `minZoom` from 0.3 to 0.05 (6x more zoom-out for large graphs)
- Set `maxZoom` to 1.15 for comfortable reading

---

### Phase 9: Intelligent Citation System & Data Flow Infrastructure

**Advanced Citation System**
- **Snippet-Based Tooltips:** Revamped citation hover behavior to display contextually relevant `snippet` data from the API response instead of just the source title.
- **Dynamic Viewport Positioning:** Implemented `CitationTooltip` and `CitationTooltipGraph` components with intelligent positioning logic:
  - Detects available viewport space (top, bottom, left, right).
  - Automatically flips or aligns tooltips to prevent edge clipping (e.g., in the node conversation panel).
  - Utilizes synchronous layout effects (`useLayoutEffect`) to calculate positions before paint, ensuring flicker-free interactions.
- **Visual Consistency:**
  - Standardized inline superscript blue badges for citations.
  - Applied elevated z-index (99999) and fixed positioning to ensure tooltips appear above all UI layers, including the graph canvas.

**Data Flow Infrastructure**
- **End-to-End Propagation:** Extended the data pipeline to carry citation data from the backend to the UI layer:
  - `lib/api.ts`: Updated `buildGraphNodesFromResponse` to include citations in the processed node objects.
  - `GraphNode` Interface: Added `citations` field to the core graph data structure.
  - `page.tsx`: Ensured the main orchestration layer passes citation data to the sidebar and graph components.
- **Message Layer integration:** Updated the `MessageBubble` component and graph markdown renderer to accept and resolve citations against local message context.

**Graph Interaction Enhancements**
- **Persistent Context:** Active node path to root remains highlighted even after closing the conversation panel.
- **Intelligent Auto-Fit:** `fitView` logic now account for node sprouting and streaming completion to keep the workspace centered.
- **Affordance Overrides:** Custom cursors for nodes and handles (`pointer`) to match interactive expectations.


---

### Phase 10: Pilot Testing & Research Strategy

**Strategy for Unmoderated Usability Testing**
- **Core Pillars:** Stemming thinking from Jobs-To-Be-Done (JTBD), the Double Diamond model, and Learning Science principles.
- **Key Metrics:**
    - *Quantitative:* Session duration, exploration depth, branch exploration rate.
    - *Learning-Specific:* Node revisit rate, citation click-through rate, research goal completion.
    - *Usability:* System Usability Scale (SUS), Single Ease Question (SEQ).

**Planned Research Tracks:**
1. **Unmoderated Usability Studies:** 8-12 participants performing scenario-based tasks (e.g., "Explore 3 directions", "Verify a claim via citations").
2. **In-App Feedback Loop:** Implementing thumbs up/down on messages and direction nodes to capture immediate utility feedback.
3. **Telemetry & Event Logging:** Tracking behavioral signals like dwell time, navigation paths, and layout preference toggles.

**Priorities for Pilot:**
- Validating the core "Explore Direction" loop.
- Measuring trust and credibility through citation interaction.
- Assessing navigation clarity in increasingly complex graphs.

---

## Technical Architecture

### File Structure Impact

```
lib/
├── api.ts          # SSE streaming, modular request builders, graph fetching
└── utils.ts        # Tailwind class merging

components/
├── graph/
│   └── knowledge-graph.tsx  # 1300+ lines: layout, animation, interaction, ConversationPanelNode
├── chat/
│   ├── chat-interface.tsx   # Voice dictation, suggestions
│   ├── chat-sidebar.tsx     # Full conversation view
│   └── node-conversation-panel.tsx  # Legacy (now integrated in graph)
├── feedback/
│   └── feedback-modal.tsx   # UX survey modal with Likert scales
├── layout/
│   └── sidebar.tsx          # Chat history, navigation, feedback button
└── ui/                      # Button, Input, Card primitives

app/
├── page.tsx        # State orchestration, view routing
└── globals.css     # Design tokens, custom animations, scrollbar hiding

docs/
├── MESSAGES_API.md           # Backend API documentation
├── REACT_FLOW_ARCHITECTURE.md # Graph usage guide
└── PROJECT_EVOLUTION.md      # This document
```

### State Flow

```
User Input → sendMessage() → SSE Stream
                                ↓
                         Update Events → Status Display
                                ↓
                         Complete Event → Graph Rebuild
                                ↓
                         useLayoutAnimation → Smooth Transition
```

---

## Key Challenges & Solutions

### Challenge 1: SSE/Stale-Closure Loading Bug
**Problem:** Graph stuck in infinite loading after directed queries.
**Root Cause:** Closure captured stale `responses` array.
**Solution:** Used `useRef` to maintain current responses alongside state.

### Challenge 2: Cross-Origin Cookies
**Problem:** Session cookies not persisting across requests.
**Solution:** Next.js rewrite proxy makes API calls same-origin, enabling automatic cookie handling.

### Challenge 3: Node Overlap in Dense Graphs
**Problem:** Dagre default settings caused overlapping nodes.
**Solution:** 
- Dynamic width calculations
- Two-tier spacing (sibling vs subtree)
- Removed fixed-width assumptions

### Challenge 4: Edge Lag During Animation
**Problem:** Edges didn't follow nodes during position animations.
**Solution:** Animate node positions via state (not CSS transforms), so React Flow updates edges frame-by-frame.

---

## Design Rationale

### Progressive Disclosure
- Nodes show only labels (minimal cognitive load)
- Summaries appear in tooltips on hover
- Full content available on click/selection

### Animation as Communication
- Sprout animations show causality (where new nodes came from)
- Exit animations provide closure (where nodes went)
- Reduces disorientation during graph changes

### Layout Predictability
- Disabled node dragging prevents user-created chaos
- Deterministic algorithms ensure consistent positioning
- Collapse/expand provides controlled complexity management

---

## Trade-offs & Limitations

| Trade-off | Implication |
|-----------|-------------|
| Per-frame animation | Higher CPU usage, but edge consistency guaranteed |
| Estimated node widths | Fast but not pixel-perfect; DOM measuring possible for exact fit |
| Dev server overhead | Slower than production; real performance should be tested in production builds |
| Single-page architecture | All state lost on refresh; consider localStorage persistence |

---

## Future Improvements

### Short-term
- [ ] Measure actual DOM widths post-render for pixel-perfect layouts
- [ ] Store collapse state in localStorage for persistence
- [ ] Add keyboard navigation and ARIA attributes for accessibility
- [x] ~~Custom zoom controls in unified toolbar~~
- [x] ~~Conversation panel as native React Flow node~~

### Medium-term
- [ ] Web Worker for layout computation on large graphs
- [ ] Hybrid animation: CSS transforms for nodes, RAF for edges
- [ ] Rich tooltip component with scroll and link handling
- [x] ~~Feedback collection modal for UX research~~
- [x] ~~Markdown rendering in conversation panels~~

### Long-term
- [ ] Low-fidelity mode for very large graphs (reduced animations)
- [ ] Offline support with service worker caching
- [ ] Collaborative editing with real-time sync

---

## Lessons Learned

1. **Iterative feedback loops accelerate quality** — Each round of user testing revealed edge cases and UX friction.

2. **Animation requires state-level control** — CSS-only animations break edge-node synchronization in graph libraries.

3. **Proxy patterns solve CORS during development** — Avoid backend configuration changes by making requests same-origin.

4. **Estimate, don't measure, for performance** — DOM measurements are expensive; character-based width estimation is "good enough" and fast.

5. **Two-tier spacing creates visual hierarchy** — Tight siblings + wide subtrees matches how users mentally group related concepts.

---

## Conclusion

Trevi evolved from a simple chat interface to a sophisticated knowledge exploration tool through iterative development. The combination of streaming APIs, graph visualization, and smooth animations creates an intuitive research experience.

The project demonstrates:
- **Modern React patterns** (hooks, refs, memoization)
- **Real-time data handling** (SSE streaming)
- **Complex animation systems** (custom layout + RAF-based tweening)
- **User-centered design** (progressive disclosure, visual feedback)

This case study illustrates how thoughtful technical decisions compound into a polished product.

---

*Document generated for portfolio and stakeholder presentation purposes.*
