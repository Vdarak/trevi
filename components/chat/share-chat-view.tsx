"use client";

import React, { useState, useRef } from 'react';
import { Route, BookOpen, Sparkle, Check, BookDown, Download, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageBubble } from './message-bubble';
import { GistCard } from '@/components/chat/gist-card';
import { type MessagePayload, type Citation, type TreviBriefResponse, downloadSharedConversation, downloadSharedGist } from '@/lib/api';

interface ConversationNode {
    id: string;
    label: string;
    payload: MessagePayload[];
    citations?: Citation[];
}

type TabType = 'thread' | 'bibliography';

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

const tabs = [
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
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Get all citations from nodes for bibliography display
    const allCitations = nodes.flatMap(node => node.citations || []);

    // Current title based on tab
    const currentTitle = rootLabel;

    // Check if gist is available
    const hasGist = !!gist;

    return (
        <div id="chat-sidebar-container" className="flex flex-col h-[100dvh] w-full bg-white overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                {/* Top row: Tabs + Branding - centered with chat content */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between py-2 min-h-[56px]">
                        {/* Tabs */}
                        <div className="flex items-center gap-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                                            transition-all duration-200
                                            ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}
                                        `}
                                    >
                                        <Icon className="w-5 h-5" />
                                        {isActive && <span>{tab.label}</span>}
                                        {isActive && (
                                            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Download button */}
                        <div className="flex items-center gap-3">
                            {/* Download Chat button - always visible */}
                            <button
                                onClick={() => downloadSharedConversation(shareToken)}
                                className="p-2 rounded-lg text-blue-600 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 active:text-blue-600 transition-colors"
                                title="Download conversation as PDF"
                            >
                                <BookDown className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Context Title - centered with chat content */}
                <div className="bg-slate-50 border-t border-slate-100">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-700 truncate flex-1">{currentTitle}</p>

                        {/* Gist Toggle Button - only shown if gist data is available */}
                        {hasGist && (
                            <div className="flex items-center">
                                {/* Download Gist Button - animated reveal when Gist is open */}
                                <AnimatePresence>
                                    {showGist && (
                                        <motion.button
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            transition={{ duration: 0.15, ease: "easeOut" }}
                                            onClick={() => downloadSharedGist(shareToken)}
                                            className="flex items-center justify-center px-2.5 py-1.5 rounded-l-lg border border-r-0 text-xs font-semibold select-none bg-white text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-colors overflow-hidden"
                                            title="Download Gist as PDF"
                                        >
                                            <Download className="w-3.5 h-3.5 flex-shrink-0" />
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                                <button
                                    onClick={() => setShowGist(!showGist)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 transition-all duration-200 
                                        border text-xs font-semibold select-none
                                        ${showGist ? "rounded-r-lg" : "rounded-lg"}
                                        ${showGist
                                            ? "bg-green-100 text-green-600 border-green-200 shadow-inner"
                                            : "bg-white text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50"}
                                    `}
                                    title={showGist ? "Hide Gist" : "Show Gist"}
                                >
                                    {showGist ? (
                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                    ) : (
                                        <Sparkle className="w-3.5 h-3.5 fill-blue-500" />
                                    )}
                                    <span>Gist</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
                {/* Gist Card Section - shown when gist data is available and showGist is true */}
                {activeTab === 'thread' && gist && showGist && (
                    <div className="border-b border-slate-100 bg-slate-50/50">
                        <div className="max-w-6xl mx-auto">
                            <GistCard
                                nodeLabel={currentTitle || "Thread Summary"}
                                onClose={() => { }}
                                briefData={gist}
                                className="border-none"
                            />
                        </div>
                    </div>
                )}

                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                    {activeTab === 'thread' ? (
                        // Thread View - Display all messages
                        <div className="space-y-4">
                            {nodes.map((node, nodeIndex) => (
                                <section key={node.id} className={nodeIndex > 0 ? 'pt-4 border-t border-slate-100' : ''}>
                                    {/* Node Label Badge - styled as pills matching chat sidebar */}
                                    {nodes.length > 1 && (
                                        <div className={`
                                            inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 
                                            rounded-full text-xs font-medium
                                            ${nodeIndex === 0
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-slate-100 text-slate-500'}
                                        `}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${nodeIndex === 0 ? 'bg-blue-500' : 'bg-slate-400'}`} />
                                            {node.label}
                                        </div>
                                    )}

                                    {/* Messages */}
                                    <div className="space-y-4">
                                        {node.payload.map((msg, msgIndex) => (
                                            <MessageBubble
                                                key={`${node.id}-${msgIndex}`}
                                                role={msg.role}
                                                content={msg.content}
                                                citations={msg.role === 'assistant' ? node.citations : undefined}
                                                hideFeedback={true}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ) : (
                        // Bibliography View
                        biblio && Object.keys(biblio).length > 0 ? (
                            <div className="space-y-6">
                                {(() => {
                                    // Collect all unique citations keyed by URL
                                    const urlToCitation = new Map<string, Citation>();
                                    nodes.forEach(node => {
                                        node.citations?.forEach(c => {
                                            if (c.url) urlToCitation.set(c.url, c);
                                        });
                                    });

                                    return Object.entries(biblio).map(([url, labels], idx) => {
                                        const citation = urlToCitation.get(url);
                                        const displayUrl = url;

                                        let displayTitle = citation?.title;
                                        if (!displayTitle) {
                                            try {
                                                const urlObj = new URL(url);
                                                displayTitle = urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
                                            } catch {
                                                displayTitle = url;
                                            }
                                        }

                                        const validLabels = labels.filter((label: string) => label !== "General");
                                        const displayIndex = idx + 1;

                                        return (
                                            <div key={url} className="group relative">
                                                <div className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100/60 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200">
                                                    {/* Index Badge */}
                                                    <div className="flex-shrink-0">
                                                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-mono font-medium text-slate-500 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                                                            {displayIndex}
                                                        </div>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        <div>
                                                            <a
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="group/link block"
                                                            >
                                                                <h4 className="text-sm font-semibold text-slate-800 leading-snug group-hover/link:text-blue-600 transition-colors line-clamp-2">
                                                                    {displayTitle}
                                                                </h4>
                                                                <div className="text-xs text-slate-400 font-mono mt-1 w-full truncate opacity-70 group-hover/link:opacity-100 transition-all">
                                                                    {displayUrl}
                                                                </div>
                                                            </a>
                                                        </div>

                                                        {validLabels.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 pt-1">
                                                                {validLabels.map((label: string, labelIdx: number) => (
                                                                    <span
                                                                        key={`${url}-${labelIdx}`}
                                                                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-semibold bg-white border border-slate-200 text-slate-500"
                                                                    >
                                                                        {label}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <BookOpen className="w-12 h-12 mb-4 text-slate-300" />
                                <p className="text-sm font-medium">No references found</p>
                                <p className="text-xs text-slate-400 mt-1">Sources will appear here once added</p>
                            </div>
                        )
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
