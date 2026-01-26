"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bug, Send, ChevronLeft, Lightbulb } from 'lucide-react';
import { submitBugReport } from '@/lib/api';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type BugType = 'graph_renderer' | 'chat' | 'connection' | 'content_loss' | 'export' | 'other' | null;

const BUG_TYPES: { id: BugType; label: string; description: string }[] = [
    { id: 'graph_renderer', label: 'Visual / Graph', description: 'Issues with the graph display' },
    { id: 'chat', label: 'Chat Problems', description: 'Issues with conversations' },
    { id: 'connection', label: 'Connection Issues', description: 'Loading or sync problems' },
    { id: 'content_loss', label: 'Content Gone', description: 'Missing or disappeared data' },
    { id: 'export', label: 'Exported Chats Or PDFs', description: 'Issues with exported files' },
    { id: 'other', label: 'Something Else', description: 'Other issues' },
];

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
    const [mounted, setMounted] = useState(false);
    const [selectedType, setSelectedType] = useState<BugType>(null);
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSubmit = async () => {
        if (!selectedType || !description.trim()) return;

        setIsSubmitting(true);
        try {
            await submitBugReport({ type: selectedType, description: description.trim() });
            setIsSubmitted(true);
        } catch (error) {
            console.error('Failed to submit bug report:', error);
            setIsSubmitted(true); // Still show success for UX
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedType(null);
        setDescription('');
        setIsSubmitted(false);
        onClose();
    };

    const handleBack = () => {
        setSelectedType(null);
        setDescription('');
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm md:p-4">
            <div className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-lg bg-white md:rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-red-50 to-rose-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                            <Bug className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Report a Bug</h2>
                            <p className="text-xs text-slate-500">Help us fix issues</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {isSubmitted ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Thank You!</h3>
                            <p className="text-sm text-slate-500">We've received your bug report and will look into it.</p>
                        </div>
                    ) : selectedType === null ? (
                        /* Type Selection */
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 mb-4">What kind of issue are you experiencing?</p>
                            <div className="grid grid-cols-2 gap-3">
                                {BUG_TYPES.map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => setSelectedType(type.id)}
                                        className="p-4 rounded-xl border-2 border-slate-200 hover:border-red-300 hover:bg-red-50/50 transition-all text-left group"
                                    >
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-red-600">{type.label}</span>
                                        <p className="text-xs text-slate-400 mt-1">{type.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Description Form with Tips */
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Tips Panel */}
                            <div className="md:w-1/3 flex-shrink-0">
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Lightbulb className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-semibold text-amber-800">Tips</span>
                                    </div>
                                    <ul className="space-y-2 text-xs text-amber-700">
                                        <li className="flex items-start gap-2">
                                            <span className="text-amber-500 mt-0.5">•</span>
                                            <span>What you expected it to do</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-amber-500 mt-0.5">•</span>
                                            <span>What it did instead</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-amber-500 mt-0.5">•</span>
                                            <span>Steps that led to it</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Description Input */}
                            <div className="flex-1">
                                <div className="mb-3">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                        {BUG_TYPES.find(t => t.id === selectedType)?.label}
                                    </span>
                                </div>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe the bug you encountered..."
                                    className="w-full h-40 px-4 py-3 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 placeholder:text-slate-400"
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!isSubmitted && (
                    <div className="flex justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
                        {selectedType !== null ? (
                            <>
                                <button
                                    onClick={handleBack}
                                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !description.trim()}
                                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Submitting...' : (
                                        <>
                                            Submit Report <Send className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <div className="w-full text-center text-xs text-slate-400">
                                Select a category to continue
                            </div>
                        )}
                    </div>
                )}

                {isSubmitted && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
                        <button
                            onClick={handleClose}
                            className="w-full px-5 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

// Bug Report button component for sidebar
export function BugReportButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 hover:border-red-200 transition-all group"
        >
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <Bug className="w-4 h-4" />
            </div>
            <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-slate-800">Report a Bug</span>
            </div>
        </button>
    );
}
