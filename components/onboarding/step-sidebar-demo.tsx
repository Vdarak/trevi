"use client";

import React, { useState, useEffect } from 'react';
import { ChatSidebar } from '@/components/chat/chat-sidebar'; // We need to check if props allow forcing state
// If ChatSidebar controls its own tab state, we might need to wrap it or just rely on its initial props if customizable.
// Let's assume for now we wrap it in a container that highlights specific parts.
import { MousePointer2 } from 'lucide-react';

const DUMMY_CONVERSATION_NODES = [
    { id: '1', label: 'Synthetic Biology', payload: [{ role: 'assistant' as const, content: 'Synthetic biology is a multidisciplinary area of research...' }], citations: [] },
    { id: '2', label: 'Gene Editing', payload: [{ role: 'assistant' as const, content: 'Gene editing technologies allow genetic material to be added, removed, or altered...' }], citations: [] },
];

const DUMMY_THREAD_NODES = [
    { id: '1', label: 'Synthetic Biology', payload: [{ role: 'assistant' as const, content: 'Synthetic biology involves...' }], citations: [] }
];

export function StepSidebarDemo() {
    const [cursorPos, setCursorPos] = useState({ x: '10%', y: '50%' });
    const [clickEffect, setClickEffect] = useState(false);

    // Animation to simulate user attention
    useEffect(() => {
        // Just simple cursor floating near the tabs to indicate interaction
        const sequence = async () => {
            await new Promise(r => setTimeout(r, 1000));
            setCursorPos({ x: '80%', y: '15%' }); // Near tabs

            await new Promise(r => setTimeout(r, 1000));
            setClickEffect(true);
            setTimeout(() => setClickEffect(false), 200);

            // Move to bibliography area
            await new Promise(r => setTimeout(r, 2000));
            setCursorPos({ x: '85%', y: '60%' });
        };
        sequence();
    }, []);

    return (
        <div className="relative h-full w-full bg-slate-50 overflow-hidden select-none">
            {/* 
               We render the ChatSidebar in a way that looks like it's part of the full layout.
               We can place it on the right side of a mock screen.
            */}
            <div className="flex h-full">
                {/* Mock Graph Background for context */}
                <div className="hidden md:flex flex-1 bg-slate-100 items-center justify-center opacity-50 filter blur-sm">
                    <div className="text-slate-300 font-bold text-4xl">Topic Tree Context</div>
                </div>

                {/* The Sidebar itself */}
                <div className="w-full md:w-[450px] h-full shadow-2xl relative z-10">
                    <ChatSidebar
                        isOpen={true} // Always open for demo
                        chatId="demo-chat"
                        conversationNodes={DUMMY_CONVERSATION_NODES}
                        threadNodes={DUMMY_THREAD_NODES}
                        rootLabel="Synthetic Biology"
                        activeLabel="Gene Editing"
                        activeNodeId="2"
                        isStreaming={false}
                        statusMessage=""
                        onSendMessage={() => { }}
                        onEditMessage={() => { }}
                        onClose={() => { }}
                    />
                </div>
            </div>

            {/* Fake Cursor Overlay */}
            <div
                className="absolute z-50 transition-all duration-1000 ease-in-out flex flex-col items-center"
                style={{
                    left: cursorPos.x,
                    top: cursorPos.y,
                }}
            >
                <MousePointer2
                    className={`w-6 h-6 text-slate-900 fill-white drop-shadow-md ${clickEffect ? 'scale-90' : 'scale-100'} transition-transform`}
                />
                {clickEffect && (
                    <div className="absolute top-0 w-8 h-8 bg-slate-400/30 rounded-full animate-ping" />
                )}
            </div>
        </div>
    );
}
