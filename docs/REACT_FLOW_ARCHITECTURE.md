# React Flow Architecture & Usage Guide

This document outlines the architecture, payload structure, and usage patterns for integrating `@xyflow/react` (React Flow) into the Trevi application.

## 1. Ideal Payload Structure

For a complex graph application like Trevi, the payload should be structured to support:
- **Persistence**: Saving and loading graph states.
- **Flexibility**: Handling different node types and data.
- **Relationships**: Clearly defining connections.

### Recommended JSON Structure

We recommend a flat structure for storage, which is easier to query and update.

```typescript
interface GraphPayload {
  id: string; // Graph ID
  name: string;
  version: number;
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number }; // Last viewed position
  createdAt: string;
  updatedAt: string;
}

// Node Definition
interface AppNode {
  id: string;
  type: 'concept' | 'resource' | 'note' | 'group'; // Custom node types
  position: { x: number; y: number };
  data: {
    label: string;
    content?: string;
    tags?: string[];
    // ... other metadata
  };
  // Optional: styling overrides
  style?: React.CSSProperties;
  parentId?: string; // For grouping
  extent?: 'parent'; // Constrain to parent
}

// Edge Definition
interface AppEdge {
  id: string;
  source: string;
  target: string;
  type: 'default' | 'smoothstep' | 'straight' | 'floating';
  label?: string;
  animated?: boolean;
  style?: React.CSSProperties; // Stroke color, width
  markerEnd?: { type: string; color?: string }; // Arrowheads
}
```

## 2. Manipulating Nodes & Connectors

### State Management
Use the `useNodesState` and `useEdgesState` hooks provided by React Flow for local state, or a global store (Zustand/Redux) for complex apps.

```tsx
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

const onConnect = useCallback(
  (params) => setEdges((eds) => addEdge(params, eds)),
  [setEdges],
);
```

### Custom Nodes
Create custom components for nodes to render rich content (images, inputs, etc.).

```tsx
// components/graph/CustomNode.tsx
import { Handle, Position } from '@xyflow/react';

export default function CustomNode({ data }) {
  return (
    <div className="p-4 border rounded-lg bg-white shadow-md border-trevi-deep">
      <Handle type="target" position={Position.Top} />
      <div className="font-bold">{data.label}</div>
      <div className="text-sm text-gray-500">{data.content}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### Connector Styling & Hover States
Edges can be styled using the `style` prop or CSS classes.

**Hover States**:
To highlight paths on hover, you need to listen to `onNodeMouseEnter` and traverse the graph.

```tsx
const onNodeMouseEnter = useCallback((event, node) => {
  // 1. Find all edges connected to this node (upstream/downstream)
  // 2. Update edge styles to highlight them
  // 3. Dim other nodes/edges
}, [edges, setEdges]);
```

## 3. Layout & Mindmap Structure

For consistent, aligned layouts (mindmap style), use a layout engine like `dagre` or `elkjs`. React Flow does not have a built-in auto-layout engine.

### Using Dagre for Auto-Layout

```tsx
import dagre from 'dagre';

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
```

## 4. Canvas Controls

React Flow provides `<Controls />`, `<MiniMap />`, and `<Background />` components.

```tsx
<ReactFlow ...>
  <Background color="#ccc" gap={16} />
  <Controls />
  <MiniMap />
</ReactFlow>
```

## 5. Path to Root Highlight

To highlight the path to the root:
1.  Identify the "root" node (usually node with no incoming edges or specific ID).
2.  On hover of a node, perform a graph traversal (BFS/DFS backwards) to find all ancestor nodes and edges.
3.  Apply a "highlighted" class or style to these elements.
