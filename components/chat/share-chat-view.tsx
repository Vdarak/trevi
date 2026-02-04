"use client";

import React, { useState, useRef } from 'react';
import { Route, BookOpen, BookDown, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GistCard } from '@/components/chat/gist-card';
import { ChatTabs, type TabDefinition } from '@/components/chat/shared/chat-tabs';
import { GistNotch } from '@/components/chat/shared/gist-notch';
import { BibliographyList } from '@/components/chat/shared/bibliography-list';
import { NodeLabelBadge } from '@/components/chat/shared/node-label-badge';
import { MessageBubble } from '@/components/chat/message-bubble';
import { type TreviBriefResponse, downloadSharedConversation, downloadSharedGist, type MessagePayload, type Citation } from '@/lib/api';

type TabType = 'thread' | 'bibliography';

interface ConversationNode {
    id: string;
    label: string;
    payload: MessagePayload[];
    citations?: Citation[];
}

interface ShareChatViewProps {
    chatId: string;
    nodes: ConversationNode[];
    rootLabel?: string;
    /** Bibliography data from share response - URL → [node_labels] */
    biblio?: Record<string, string[]>;
    /** Gist/Brief data from share response */
    gist?: TreviBriefResponse['trevi_brief'] | null;
    /** Share token for download APIs */
    shareToken: string;
}

const tabs: TabDefinition[] = [
    { id: 'thread' as TabType, label: 'Thread', icon: Route },
    { id: 'bibliography' as TabType, label: 'Bibliography', icon: BookOpen },
];

/**
 * Public share chat view - read-only conversation display.
 * Full width, no feedback/close buttons, with Trevi branding.
 */
export function ShareChatView({
    chatId,
    nodes,
    rootLabel = 'Shared Conversation',
    biblio,
    gist,
    shareToken,
}: ShareChatViewProps) {
    const [activeTab, setActiveTab] = useState<TabType>('thread');
    const [showGist, setShowGist] = useState(!!gist); // Auto-show if gist data exists
    const [isDownloadingGist, setIsDownloadingGist] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Get all citations from nodes for bibliography display
    const allCitations = nodes.flatMap(node => node.citations || []);

    // Current title based on tab
    const currentTitle = rootLabel;

    // Check if gist is available
    const hasGist = !!gist;

    // Show gist notch only on thread tab when gist data exists
    const showGistNotch = activeTab === 'thread' && hasGist;

    return (
        <div id="chat-sidebar-container" className="flex flex-col h-[100dvh] w-full bg-white overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                {/* Top row: Tabs */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between py-2 min-h-[56px]">
                        {/* Tabs */}
                        <ChatTabs
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={(id) => setActiveTab(id as TabType)}
                        />
                    </div>
                </div>

                {/* Context Title with Download Button - visible on both tabs */}
                <div className="bg-slate-50 border-t border-slate-100">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-700 truncate flex-1">{currentTitle}</p>
                        {/* Download button - inline with title, only on thread tab */}
                        {activeTab === 'thread' && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={() => downloadSharedConversation(shareToken)}
                                    className="p-1.5 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                                    title="Download conversation as PDF"
                                >
                                    <BookDown className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Notch + Gist Content Container - sticky, pushes content down */}
            {showGistNotch && (
                <div className="flex-shrink-0 relative bg-white">
                    {/* Gist Content Expands HERE - before the notch in DOM */}
                    <AnimatePresence>
                        {showGist && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="overflow-hidden"
                            >
                                <div className="border-b border-slate-100 bg-slate-50/50">
                                    <div className="max-w-6xl mx-auto">
                                        <GistCard
                                            nodeLabel={currentTitle || "Thread Summary"}
                                            onClose={() => setShowGist(false)}
                                            briefData={gist}
                                            className="border-none"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* GistNotch Component - floats over content below */}
                    <div className="max-w-6xl mx-auto px-4 sm:px-6">
                        <GistNotch
                            isOpen={showGist}
                            isLoading={false}
                            isDownloading={isDownloadingGist}
                            hasData={hasGist}
                            onToggle={() => setShowGist(!showGist)}
                            onDownload={async () => {
                                setIsDownloadingGist(true);
                                try {
                                    await downloadSharedGist(shareToken);
                                } catch (err) {
                                    console.error('Download failed:', err);
                                } finally {
                                    setIsDownloadingGist(false);
                                }
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                    {activeTab === 'thread' ? (
                        // Thread View - Display all messages
                        <div className="space-y-4">
                            {nodes.map((node, idx) => (
                                <section
                                    key={node.id}
                                    className={idx > 0 ? 'pt-4 border-t border-slate-100' : ''}
                                >
                                    {/* Node Label Badge */}
                                    {nodes.length > 1 && (
                                        <NodeLabelBadge label={node.label} />
                                    )}

                                    {/* Messages */}
                                    <div className="space-y-4">
                                        {(node.payload || []).map((msg, msgIdx) => (
                                            <MessageBubble
                                                key={`${node.id}-${msgIdx}`}
                                                role={msg.role}
                                                content={msg.content}
                                                citations={node.citations}
                                                hideFeedback={true}
                                                nodeId={node.id}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ) : (
                        // Bibliography View
                        <BibliographyList
                            bibliography={biblio || {}}
                            citations={allCitations}
                            emptyMessage="No references found"
                        />
                    )}
                </div>
            </div>

            {/* Bottom CTA Button */}
            <div className="flex-shrink-0 border-t border-slate-200 bg-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-center">
                    <a
                        href={typeof window !== 'undefined' ? window.location.origin : 'https://trevi.fyi'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-200 transition-colors group"
                    >
                        <div className="rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32 }}>
                            <svg
                                width={24}
                                height={25.6}
                                viewBox="-4 -4 42 42"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M21.2078 16.8104L21.2078 29.1922C21.2078 31.019 19.7268 32.5 17.8999 32.5C16.0731 32.5 14.5921 31.019 14.5921 29.1922L14.5921 8.04607C14.5921 4.43078 11.6614 1.5 8.04607 1.5L5.70195 1.5C3.38128 1.5 1.5 3.38128 1.5 5.70196C1.5 8.02263 3.38128 9.90391 5.70195 9.90391L30.5 9.90391"
                                    stroke="#fff"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    fill="none"
                                />
                                <circle cx="30.5" cy="9.90391" r="3" fill="#fff" />
                            </svg>
                        </div>
                        <span>Researched on Trevi. Try it for free.</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </a>
                </div>
            </div>
        </div>
    );
}
