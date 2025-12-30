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

## Technical Architecture

### File Structure Impact

```
lib/
├── api.ts          # SSE streaming, modular request builders, graph fetching
└── utils.ts        # Tailwind class merging

components/
├── graph/
│   └── knowledge-graph.tsx  # 1000+ lines: layout, animation, interaction
├── chat/
│   └── chat-interface.tsx   # Voice dictation, suggestions
├── layout/
│   └── sidebar.tsx          # Chat history, navigation
└── ui/                      # Button, Input, Card primitives

app/
├── page.tsx        # State orchestration, view routing
└── globals.css     # Design tokens, custom animations

docs/
├── MESSAGES_API.md           # Backend API documentation
└── REACT_FLOW_ARCHITECTURE.md # Graph usage guide
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

### Medium-term
- [ ] Web Worker for layout computation on large graphs
- [ ] Hybrid animation: CSS transforms for nodes, RAF for edges
- [ ] Rich tooltip component with scroll and link handling

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
