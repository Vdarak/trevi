# React Flow Architecture

Graph visualization using `@xyflow/react` with automatic dagre layout.

## Usage

```tsx
import { KnowledgeGraph, buildGraphFromResponses } from '@/components/graph/knowledge-graph';

// Build nodes from API responses
const nodes = buildGraphFromResponses(apiResponses);

// Render graph
<KnowledgeGraph 
  nodes={nodes} 
  rootNodeId="abc123" 
  onNodeClick={(id) => setSelectedNode(id)} 
/>
```

## Types

```typescript
interface GraphNode {
  id: string;
  label: string;
  summary?: string;
  parentId: string | null;  // null for root node
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  rootNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
}
```

## Features

| Feature | Description |
|---------|-------------|
| Auto-layout | Uses dagre for tree structure |
| Fixed nodes | Drag disabled for alignment |
| Hover path | Dotted line from node to root |
| Custom nodes | Styled with label + summary |

## Layout Settings

- Direction: Top-to-bottom
- Horizontal spacing: 80px
- Vertical spacing: 100px
- Node width: 200px
