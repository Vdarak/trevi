"use client";

import React, { useState, useEffect, useRef } from 'react';
import { KnowledgeGraph, GraphNode } from '@/components/graph/knowledge-graph';
import { MousePointer2 } from 'lucide-react';

const DUMMY_NODES: GraphNode[] = [
    { id: '1', label: 'Synthetic Biology', parentId: null },
    { id: '2', label: 'Gene Editing', parentId: '1' },
    { id: '3', label: 'Biofuels', parentId: '1' },
    { id: '4', label: 'CRISPR', parentId: '2' },
    { id: '5', label: 'Ethics', parentId: '1' },
];

export function StepGraphDemo() {
    // We use the actual KnowledgeGraph but provide it with static dummy interaction handlers
    // To simulate "User clicking", we can either programmatically trigger things or just visual cursor movement.
    // The prompt asked for "animation of user clicking arrow to expand...".
    // Since KnowledgeGraph is interactive canvas (D3/Canvas), programmatically faking a click inside it is hard.
    // Instead, I will overlay a fake cursor that moves to positions and I will trigger the STATE changes that WOULD happen.

    // State for the graph to react to our "fake" interactions
    const [nodes, setNodes] = useState<GraphNode[]>(DUMMY_NODES.slice(0, 1)); // Start with just root
    const [cursorPos, setCursorPos] = useState({ x: '50%', y: '50%' });
    const [cursorVisible, setCursorVisible] = useState(true);
    const [clickEffect, setClickEffect] = useState(false);

    useEffect(() => {
        // Animation Timeline
        // 0s: Start
        // 1s: Move cursor to Root Node
        // 2s: "Click" Root -> Expand children
        // 4s: Move cursor to "Layout" control (faked position) OR just pan graph

        const sequence = async () => {
            // Wait start
            await new Promise(r => setTimeout(r, 1000));

            // Move to center (Root)
            setCursorPos({ x: '50%', y: '50%' });

            // Click Effect
            await new Promise(r => setTimeout(r, 1000));
            setClickEffect(true);
            setTimeout(() => setClickEffect(false), 200);

            // Expand Nodes 1 (Children appear)
            setNodes(DUMMY_NODES.slice(0, 3)); // Add gen editing, biofuels

            // Move to Gene Editing
            await new Promise(r => setTimeout(r, 1500));
            setCursorPos({ x: '60%', y: '40%' }); // Approx position relative to screen center

            // Click Effect
            await new Promise(r => setTimeout(r, 1000));
            setClickEffect(true);
            setTimeout(() => setClickEffect(false), 200);

            // Expand Nodes 2
            setNodes(DUMMY_NODES); // All nodes

            // Zoom/Fit (Simulated via key/prop if supported or just implied)
        };

        sequence();
    }, []);

    return (
        <div className="relative h-full w-full bg-white overflow-hidden pointer-events-none select-none">
            <KnowledgeGraph
                nodes={nodes}
                rootNodeId="1"
                onNodeClick={() => { }}
                onDirectionClick={() => { }} // No-op for demo
                loadingNodeIds={new Set()}
                onToggleChatSidebar={() => { }}
                isChatSidebarOpen={false}
                initialActiveNodeId="1"
                onNodeMessage={() => { }}
                isNodeStreaming={false}
                nodeStatusMessage=""
                globalStatus={{
                    isActive: false, message: '', type: 'idle',
                    activeNodeLabel: 'Synthetic Biology',
                    exploringNodeIds: [], exploringNodeLabels: [], errors: []
                }}
            />

            {/* Fake Cursor Overlay */}
            <div
                className="absolute z-50 transition-all duration-1000 ease-in-out flex flex-col items-center"
                style={{
                    left: cursorPos.x,
                    top: cursorPos.y,
                    opacity: cursorVisible ? 1 : 0
                }}
            >
                <MousePointer2
                    className={`w-6 h-6 text-slate-900 fill-white drop-shadow-md ${clickEffect ? 'scale-90' : 'scale-100'} transition-transform`}
                />
                {clickEffect && (
                    <div className="absolute top-0 w-8 h-8 bg-slate-400/30 rounded-full animate-ping" />
                )}
            </div>

            {/* Explainer Labels (Floating) */}
            <div className="absolute top-20 right-8 bg-white/90 backdrop-blur border border-slate-200 p-3 rounded-lg shadow-sm max-w-[200px] animate-in slide-in-from-right duration-700 delay-500">
                <p className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">Interactive Topic Tree</span>
                    <br />
                    Click nodes to explore deeper. Drag to pan. Scroll to zoom.
                </p>
            </div>
        </div>
    );
}
