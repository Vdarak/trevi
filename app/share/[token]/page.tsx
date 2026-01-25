"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { ShareChatView } from '@/components/chat/share-chat-view';
import { getSharedChat, type SharedChatNode, type MessagePayload, type Citation, type TreviBriefResponse } from '@/lib/api';

interface ConversationNode {
    id: string;
    label: string;
    payload: MessagePayload[];
    citations?: Citation[];
}

export default function SharePage() {
    const params = useParams();
    const token = params.token as string;

    const [nodes, setNodes] = useState<ConversationNode[]>([]);
    const [chatId, setChatId] = useState<string>('');
    const [rootLabel, setRootLabel] = useState<string>('Shared Conversation');
    const [biblio, setBiblio] = useState<Record<string, string[]> | undefined>(undefined);
    const [gist, setGist] = useState<TreviBriefResponse['trevi_brief'] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        async function fetchSharedChat() {
            setIsLoading(true);
            setError(null);

            try {
                const data = await getSharedChat(token);

                // Convert SharedChatNode[] to ConversationNode[]
                const conversationNodes: ConversationNode[] = data.graph.nodes
                    .filter(node => node.type === 'conversation')
                    .map((node: SharedChatNode) => ({
                        id: node.id,
                        label: node.node_label,
                        payload: node.payload,
                        citations: node.citations,
                    }));

                setNodes(conversationNodes);

                // Use the first node's label as root label if available
                if (conversationNodes.length > 0) {
                    setRootLabel(conversationNodes[0].label);
                }

                // Store bibliography from response
                if (data.graph.biblio) {
                    setBiblio(data.graph.biblio);
                }

                // Store gist from response
                if (data.gist) {
                    setGist(data.gist);
                }

                // Use token as chatId
                setChatId(token);

            } catch (err) {
                console.error('Failed to fetch shared chat:', err);
                if (err instanceof Error) {
                    if (err.message.includes('404') || err.message.includes('Not Found')) {
                        setError('This share link has expired or does not exist.');
                    } else {
                        setError('Failed to load shared conversation. Please try again.');
                    }
                } else {
                    setError('An unexpected error occurred.');
                }
            } finally {
                setIsLoading(false);
            }
        }

        fetchSharedChat();
    }, [token]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white">
                <Loader2 className="w-10 h-10 mb-4 animate-spin text-blue-500" />
                <p className="text-slate-500 font-medium">Loading shared conversation...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
                <div className="flex flex-col items-center text-center max-w-md">
                    <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
                    <h1 className="text-xl font-semibold text-slate-800 mb-2">
                        Unable to Load Conversation
                    </h1>
                    <p className="text-slate-500">{error}</p>
                    <a
                        href="https://trevi.fyi"
                        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                        Go to Trevi
                    </a>
                </div>
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
                <div className="flex flex-col items-center text-center max-w-md">
                    <AlertCircle className="w-12 h-12 mb-4 text-amber-400" />
                    <h1 className="text-xl font-semibold text-slate-800 mb-2">
                        No Content Found
                    </h1>
                    <p className="text-slate-500">This shared conversation appears to be empty.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <ShareChatView
                chatId={chatId}
                nodes={nodes}
                rootLabel={rootLabel}
                biblio={biblio}
                gist={gist}
            />
        </div>
    );
}
