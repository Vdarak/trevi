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
🧪 Pilot Testing Strategy for Trevi
Understanding Your Context
Trevi is an AI-powered research and brainstorming tool that visualizes conversations as explorable knowledge graphs—similar to NotebookLM in its learning/research orientation. Current features include:

Knowledge graph exploration (expand/collapse nodes, direction-based exploration)
SSE streaming chat with AI responses
Conversation visualization (tree-based layout with animations)
Citation system (source attribution)
Basic feedback modal (already implemented!)
1. 🎯 Where to Stem Your Thinking From
Your thinking should stem from three foundational pillars:

A. Jobs-To-Be-Done (JTBD) Framework
Ask: What job is the user hiring Trevi to do?

Learning/Research: "Help me understand a complex topic by exploring it visually"
Synthesis: "Help me see how concepts connect"
Discovery: "Help me find related areas I didn't know to ask about"
B. The Double Diamond Model
Discover: What are users actually trying to accomplish?
Define: What specific problems does Trevi solve?
Develop: How well does the current implementation solve them?
Deliver: What refinements maximize value?
C. Learning Science Principles (Since it's a learning tool)
Elaborative Interrogation: Does the graph help users ask "why" and "how"?
Spaced/Distributed Practice: Could users return and build on previous explorations?
Concrete Examples: Are the AI responses grounded in references/citations?
2. 📊 Metrics That Actually Matter for a Learning Tool
Engagement Metrics (Quantitative)
Metric	What It Measures	How to Collect
Session Duration	Time spent actively exploring	Timestamp events
Exploration Depth	Max graph depth reached per session	Track node depth
Branch Exploration Rate	How many direction nodes clicked vs. available	Log direction clicks
Return Rate	Users returning to previous conversations	Session analytics
Message-to-Graph Ratio	How often users explore vs. just chat	Event logging
Learning-Specific Metrics
Metric	What It Measures	Why It Matters
Node Revisit Rate	How often users return to previous nodes	Indicates comprehension/reference behavior
Citation Click-Through Rate	Are users verifying sources?	Shows depth of engagement
Follow-up Question Depth	Quality/sophistication of subsequent questions	Shows learning progression
Time-to-First-Exploration	How quickly users start exploring the graph	Measures UI intuitiveness
Usability Metrics
Metric	What It Measures
Task Completion Rate	Can users accomplish specific research goals?
Error/Recovery Rate	How often users get "stuck" and how they recover
Feature Discovery Rate	Do users find collapse/expand, layout toggles, etc.?
3. 🔬 Unmoderated Usability Testing Strategy
Study Structure
Participants: 8-12 users (aim for your target persona—researchers, students, curious learners)

Duration: 15-25 minutes per session

Recording: Screen + optional audio (consider tools like Hotjar, FullStory, or simple browser-based recording)

Task Scenarios
Task 1: Initial Navigation (Feature Discovery)
"You want to research the topic of 'renewable energy technologies.' Start by entering a question and then explore at least 3 related directions in the resulting graph."

Measures: Time-to-first-exploration, feature discovery, navigation patterns

Task 2: Deep Dive (Understanding Value Proposition)
"You're writing a paper on a topic you chose. Use Trevi to explore this topic until you feel you've found 3 interesting sub-topics you didn't initially think of."

Measures: Exploration depth, branch exploration rate, "aha moment" triggers

Task 3: Reference Verification (Citation Behavior)
"Find a specific claim in one of the AI responses and verify its source using the provided citations."

Measures: Citation CTR, comprehension of citation UI

Task 4: Return & Resume (Memory/State)
"Imagine you started this research yesterday and are returning today. Navigate back to a previous topic and continue exploring from there."

Measures: Navigation clarity, state management UX

Task 5: Compare Orientations (Preference Testing)
"Try switching between the vertical (↓) and horizontal (→) layout modes. Which one helps you understand the topic relationships better?"

Measures: Layout preference (ties to your existing feedback modal!)

4. 📝 Survey Questions Framework
Post-Task Questions (After Each Scenario)
Single Ease Question (SEQ) – After each task:

"Overall, how easy or difficult was this task?"
[1-7 scale: Very Difficult → Very Easy]

Confidence in Output:

"How confident are you that you found accurate information during this task?"
[1-5 scale]

Post-Session Questions (End of Study)
A. System Usability Scale (SUS) – Industry Standard
10 standardized questions that produce a benchmarkable score (0-100).

B. Learning-Specific Questions
Question	Scale	Why Ask
"The visual graph helped me understand how concepts connect."	Likert 1-5	Core value prop validation
"I discovered ideas I wouldn't have found through regular search."	Likert 1-5	Differentiation from alternatives
"This tool would help me learn faster than reading articles alone."	Likert 1-5	Learning efficiency
"I knew where to click to explore new directions."	Likert 1-5	Navigation clarity
"The AI responses felt trustworthy and well-sourced."	Likert 1-5	Trust & credibility
"I would use this tool for my research/study."	Likert 1-5	Intent to use
C. Open-Ended Questions (Critical!)
"What was the most confusing part of using this tool?" (Pain points)
"What was your 'aha moment' – when did something click?" (Value triggers)
"What would make you use this every day?" (Feature priorities)
"How would you describe this tool to a friend?" (Positioning validation)
5. 👍👎 In-App Feedback Implementation
Level 1: Message-Level Feedback (Quick)
For each AI response node:

[👍] [👎]
On 👍: Optional tooltip → "What made this helpful?" [dropdown: Accurate, Well-explained, Good sources, Other]
On 👎: Required tooltip → "What went wrong?" [dropdown: Inaccurate, Confusing, Wrong topic, Missing sources, Other] + optional text
Level 2: Direction Node Feedback
After clicking a direction node:

"Was this direction helpful?" [👍] [👎]
Measures: Quality of AI-generated exploration suggestions

Level 3: Session-End Prompt
After 10+ minutes of activity OR when closing the tab:

"Quick feedback: Did you find what you were looking for?" [Yes, partially] [Yes, completely] [No]

Level 4: Passive Behavioral Signals
Implicit positive: Long dwell time on a node, citation clicks, follow-up questions
Implicit negative: Immediate back navigation, repeated rephrasing, session abandonment
6. 📈 Data Collection Architecture
Event Taxonomy (What to Log)
typescript
interface TelemetryEvent {
  eventType: 
    | 'session_start' | 'session_end'
    | 'message_sent' | 'response_received'
    | 'direction_clicked' | 'node_clicked' | 'node_expanded' | 'node_collapsed'
    | 'citation_hovered' | 'citation_clicked'
    | 'layout_changed' | 'orientation_changed'
    | 'zoom_changed' | 'fit_view_triggered'
    | 'feedback_thumbs_up' | 'feedback_thumbs_down'
    | 'feedback_modal_opened' | 'feedback_submitted';
  
  timestamp: string;
  sessionId: string;
  chatId?: string;
  nodeId?: string;
  nodeDepth?: number;
  metadata?: Record<string, any>;
}
Storage Options (Simple)
Console logging during pilot (for your review)
LocalStorage aggregation (then export on feedback submit)
Simple backend endpoint that writes to JSON/CSV
Third-party: Mixpanel free tier, PostHog (self-hosted), Plausible
7. 🎯 What to Prioritize in Pilot Testing
Priority 1: Core Loop Validation
"Do users understand and use the explore-via-directions paradigm?"

This is your unique value proposition. If users don't click direction nodes, the product fails.

Priority 2: Trust & Credibility
"Do users trust the AI responses enough to act on them?"

For a learning tool, trust is paramount. Citations must feel reliable.

Priority 3: Navigation & Orientation
"Can users navigate a growing graph without feeling lost?"

Collapse/expand, path highlighting, and layout become critical at scale.

Priority 4: Value Articulation
"Can users explain what this tool does better than alternatives?"

This determines word-of-mouth and PMF.

8. 🚀 Quick Implementation Roadmap
Phase 1: Instrumentation (Add Event Logging)
Add basic telemetry events to key interactions
Extend your existing 
FeedbackModal
 to include session data export
Phase 2: In-App Feedback UI
Add 👍/👎 to AI response messages in conversation panel
Add optional "why" dropdown on thumbs down
Phase 3: Unmoderated Study Setup
Create a study guide document with tasks
Set up screen recording (or use Hotjar/FullStory)
Recruit 8-12 participants
Phase 4: Analysis
Analyze completion rates, behavioral patterns, and qualitative feedback
Identify top 3 friction points
Prioritize fixes
Summary: Key Questions Your Pilot Should Answer
Discovery: Do users find and use direction nodes?
Understanding: Does the graph visualization aid comprehension?
Trust: Do users believe the AI's responses?
Navigation: Can users manage complex, deep graphs?
Value: Would users choose this over ChatGPT + manual note-taking?




---

### Phase 11: UI/UX Enhancements & Optimization

**Focus:** Polishing the core experience, improving state persistence, and refining the visual interface based on pilot feedback.

**Key Features Implemented:**

1.  **Synchronized Camera Animation**
    *   **Problem:** Camera movement felt disconnected from node expansion animations.
    *   **Solution:** Integrated `fitBounds` directly into the `toggleCollapse` logic with a matching **1200ms** duration.
    *   **Result:** Camera pans and zooms *in parallel* with the sprouting nodes, guiding user attention smoothly.

2.  **Persistent Knowledge Spaces (SWR Pattern)**
    *   **Renaming:** Shifted from generic "Chats" to "Knowledge Spaces" to reflect the tool's research nature.
    *   **Optimistic UI:** Implemented `pendingChats` state to show the user's query immediately as the "Knowledge Space" name with a loading spinner, preventing UI layout shifts.
    *   **Silent Refresh:** Background revalidation updates the official chat title once generated by the API.

3.  **Active Node Persistence**
    *   **Problem:** Reloading the page or switching chats caused users to lose their "place" in the graph.
    *   **Solution:** Synced `activeNodeId` to `localStorage` keyed by `chatId`.
    *   **Result:** Returning to a Knowledge Space restores the exact node selection and path highlighting.

4.  **Information-First Design**
    *   **Redesign:** Transformed `NodeConversationPanel` from a chat-like interface to a dedicated definition/information panel.
    *   **Filtering:** Filtered out repetitive user messages to focus purely on the AI's explanation.
    *   **Typography:** Adopted `prose` styling (typography plugin) for optimal readability of complex topics.

5.  **Dialog-Style Citations**
    *   **Evolution:** Moved from simple native tooltips to rich, interactive dialogs.
    *   **Features:**
        *   Scrollable content area for long snippets
        *   Bold text formatting support
        *   Dedicated footer with source title and link icon
        *   Larger surface area (320px width) for better readability

**Technical Refinements:**
*   **Auto-Fit Logic:** Added strict checks to trigger `fitView` only on specific `rootNodeId` changes, preventing unwanted camera jumps during streaming.
*   **Linting:** Resolved TypeScript types for node labels and event handlers.

---

### Phase 12: Mobile Optimization & UI Refinement (January 2026)

**Focus:** Comprehensive mobile experience improvement, UI consistency, and advanced interaction patterns based on real-world usage.

#### 1. Mobile-First Responsive Design

**Chat Sidebar Redesign**
- Complete visual refresh with consistent styling across the application
- Implemented entrance/exit animations (slide-in from right with backdrop fade)
- Fixed mobile scrolling issues with proper height calculations
- Full-screen mobile modal view for conversation panels
- Added safe-area support for notched devices

**Resizable Chat Sidebar (Desktop)**
- Drag-to-resize functionality (400px minimum, 50vw maximum)
- Visual resize handle with GripVertical icon on left edge
- Smooth resize with cursor feedback
- Width persistence across interactions

**Bottom Tab Navigation**
- Clean tab bar for Graph/Chat switching on mobile
- Removed redundant mobile status indicators
- Proper height accounting for header and bottom navigation

#### 2. Status & Progress Indicators

**Global Status Pill**
- Unified status indicator showing current activity
- Active state: Blue background with pulsing dot + status message
- Idle state: White background with green dot + active node label
- Positioned at top center, visible on all screen sizes
- Updates dynamically with graph interactions

**Status Synchronization**
- Status pill reflects active node changes
- Updates on node collapse/expand operations
- Synchronized with global streaming/loading states

#### 3. Enhanced Graph Interactions

**Multi-Panel Support**
- Multiple conversation panels can be open simultaneously
- Fixed panel persistence during layout animations
- Proper panel cleanup on node operations
- Individual close handlers for each panel

**Smart Node Collapse Behavior**
- Auto-closes conversation panels when node is collapsed
- Transfers active highlight to parent when collapsing descendant
- Updates global status and minimap on collapse
- Preserves user context during graph restructuring

**Modal Interactions**
- Click position-based animation origin for modal entrance
- Smooth scale-in from exact click location
- Minimap remains visible behind modal backdrop
- Full-screen on mobile for optimal space usage

#### 4. Minimap Enhancements

**Dynamic Path Visualization**
- Active node: Bright blue fill with dark blue stroke
- Path to root nodes: Light blue fill with blue stroke
- Root node: Dark slate fill for hierarchy anchor
- Real-time updates matching canvas highlighting
- Stroke width of 2px for better visibility

**State Synchronization**
- Minimap reflects active path changes instantly
- Updates on node selection and collapse operations
- Matches main canvas visual language

#### 5. Chat & Communication Features

**Thread-First Navigation**
- Thread tab set as primary/default view
- Reordered tabs: Thread → Full → Sources
- Automatic scroll to active node section in both views
- Improved empty states with helpful messaging

**Enhanced Message Rendering**
- Full markdown support in modals (headers, lists, blockquotes, links)
- Visible scrollbars with thin, subtle styling
- Node label badges with active state indicators
- Citation tooltips with portal-based positioning

**Auto-Scroll Intelligence**
- Scrolls to active node when switching tabs
- Preserves scroll position when appropriate
- Smooth scroll behavior with proper timing

#### 6. Loading States & Visual Polish

**Pending Chat Styling**
- Loading chats styled as cards with subtle blue tint
- Pulsing indicator for active loading state
- Consistent with established card design system
- Smooth transitions between loading and loaded states

**Animation System**
- Entrance/exit animations for sidebar
- Modal scale animation from click origin
- Panel toggle animations without flicker
- Coordinated timing across UI elements

#### Technical Improvements

**Mobile Architecture**
- Fixed positioning with proper z-index management
- Touch-friendly scroll with overscroll-contain
- WebKit overflow scrolling optimization
- Proper event handling for touch interactions

**State Management**
- Panel nodes preserved during layout animations
- Edge deduplication to prevent React key conflicts
- Proper cleanup on unmount with timeout handling
- Ref-based node tracking for scroll targets

**Performance**
- Efficient resize handling with throttled updates
- Optimized re-renders with proper memoization
- Background task cleanup on component unmount
- Smooth 60fps animations with GPU acceleration

#### Design System Consistency

**Color Palette**
- Blue (#3b82f6, #93c5fd) for active states
- Slate (#0f172a, #e2e8f0, #cbd5e1) for structure
- Consistent hover/focus states across components
- Semantic color usage (blue = active, green = ready)

**Typography & Spacing**
- 14px header height for clean tab interface
- Consistent padding (12px, 16px) across sections
- Font sizes: xs (12px), sm (14px), base (16px)
- Rounded corners: xl (12px) for primary surfaces

**Interactive Elements**
- Blue-600 primary buttons with hover states
- Subtle slate backgrounds for secondary surfaces
- 2px border-radius on active indicators
- Consistent icon sizing (16px, 20px)

#### Key Metrics & Outcomes

**Mobile Experience**
- Full-screen utilization on mobile devices
- Smooth 300ms animation timing throughout
- Touch-optimized interaction targets
- Zero layout shift during loading states

**Desktop Enhancements**
- Resizable sidebar from 400px to 50vw
- Multiple concurrent conversation panels
- Persistent width preferences
- Professional resize affordances

**User Context Preservation**
- Active node highlighting maintained during collapse
- Panel cleanup coordinated with node operations
- Status indicators always reflect current state
- Scroll position intelligence across views

*This phase represents a maturation of the product from functional prototype to polished, production-ready application with comprehensive mobile support and sophisticated interaction patterns.*

---

*Document generated for portfolio and stakeholder presentation purposes.*
