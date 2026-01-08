"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquarePlus, Send } from 'lucide-react';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type LikertValue = 1 | 2 | 3 | 4 | 5 | null;

interface FeedbackData {
    layoutPreference: 'spacious' | 'compact' | null;
    orientationPreference: 'vertical' | 'horizontal' | null;
    overallUsability: LikertValue;
    controlsClarity: LikertValue;
    navigationEase: LikertValue;
    visualClarity: LikertValue;
    learningEffectiveness: LikertValue;
    qualitativeFeedback: string;
    improvementSuggestion: string;
}

const LIKERT_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const [mounted, setMounted] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [feedback, setFeedback] = useState<FeedbackData>({
        layoutPreference: null,
        orientationPreference: null,
        overallUsability: null,
        controlsClarity: null,
        navigationEase: null,
        visualClarity: null,
        learningEffectiveness: null,
        qualitativeFeedback: '',
        improvementSuggestion: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Mount state for portal - ensures we're on client side
    useEffect(() => {
        setMounted(true);
    }, []);

    const handleLikertChange = (field: keyof FeedbackData, value: LikertValue) => {
        setFeedback(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        // In a real app, send to backend
        console.log('Feedback submitted:', feedback);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSubmitting(false);
        setIsSubmitted(true);
    };

    const handleClose = () => {
        setCurrentStep(0);
        setIsSubmitted(false);
        setFeedback({
            layoutPreference: null,
            orientationPreference: null,
            overallUsability: null,
            controlsClarity: null,
            navigationEase: null,
            visualClarity: null,
            learningEffectiveness: null,
            qualitativeFeedback: '',
            improvementSuggestion: '',
        });
        onClose();
    };

    // Don't render until mounted (for portal) and don't render if not open
    if (!mounted || !isOpen) return null;

    const renderLikertScale = (
        field: keyof FeedbackData,
        question: string
    ) => (
        <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">{question}</p>
            <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                    <button
                        key={value}
                        onClick={() => handleLikertChange(field, value as LikertValue)}
                        className={`flex-1 py-2 px-1 rounded-lg text-xs font-medium transition-all
              ${feedback[field] === value
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        {value}
                    </button>
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 px-1">
                <span>Strongly Disagree</span>
                <span>Strongly Agree</span>
            </div>
        </div>
    );

    const steps = [
        // Step 0: All Preferences + Likert Scales (scrollable)
        <div key="quantitative" className="space-y-5">
            {/* Layout Preference */}
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Which graph layout do you prefer?</p>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFeedback(prev => ({ ...prev, layoutPreference: 'spacious' }))}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                            ${feedback.layoutPreference === 'spacious'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Spacious
                    </button>
                    <button
                        onClick={() => setFeedback(prev => ({ ...prev, layoutPreference: 'compact' }))}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                            ${feedback.layoutPreference === 'compact'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Compact
                    </button>
                </div>
            </div>

            {/* Orientation Preference */}
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Which orientation helps you understand better?</p>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFeedback(prev => ({ ...prev, orientationPreference: 'vertical' }))}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                            ${feedback.orientationPreference === 'vertical'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Top to Bottom ↓
                    </button>
                    <button
                        onClick={() => setFeedback(prev => ({ ...prev, orientationPreference: 'horizontal' }))}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                            ${feedback.orientationPreference === 'horizontal'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Left to Right →
                    </button>
                </div>
            </div>

            {/* All Likert Scales */}
            {renderLikertScale('overallUsability', 'The application was easy to use overall.')}
            {renderLikertScale('controlsClarity', 'The controls were intuitive.')}
            {renderLikertScale('navigationEase', 'Navigating the graph was straightforward.')}
            {renderLikertScale('visualClarity', 'The visual design helped me focus.')}
            {renderLikertScale('learningEffectiveness', 'This tool helps me learn effectively.')}
        </div>,

        // Step 1: Subjective/Qualitative Questions
        <div key="qualitative" className="space-y-5">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">What did you like most about this experience?</p>
                <textarea
                    value={feedback.qualitativeFeedback}
                    onChange={(e) => setFeedback(prev => ({ ...prev, qualitativeFeedback: e.target.value }))}
                    placeholder="Share your thoughts..."
                    className="w-full h-28 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">What would you improve or add?</p>
                <textarea
                    value={feedback.improvementSuggestion}
                    onChange={(e) => setFeedback(prev => ({ ...prev, improvementSuggestion: e.target.value }))}
                    placeholder="Your suggestions help us improve..."
                    className="w-full h-28 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>,
    ];

    // Render using portal to escape parent container's stacking context
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm md:p-4">
            <div className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-md bg-white md:rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                            <MessageSquarePlus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Share Your Feedback</h2>
                            <p className="text-xs text-slate-500">Help us improve your experience</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {isSubmitted ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Thank You!</h3>
                            <p className="text-sm text-slate-500">Your feedback helps us build a better learning experience.</p>
                        </div>
                    ) : (
                        <>
                            {/* Progress */}
                            <div className="flex gap-1 mb-6">
                                {steps.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`flex-1 h-1 rounded-full transition-colors ${i <= currentStep ? 'bg-blue-500' : 'bg-slate-200'}`}
                                    />
                                ))}
                            </div>

                            {/* Current Step */}
                            {steps[currentStep]}
                        </>
                    )}
                </div>

                {/* Footer - sticky at bottom */}
                {!isSubmitted && (
                    <div className="flex justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 mt-auto">
                        <button
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={currentStep === 0}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Back
                        </button>

                        {currentStep < steps.length - 1 ? (
                            <button
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                className="px-5 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? 'Submitting...' : (
                                    <>
                                        Submit <Send className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {isSubmitted && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 mt-auto">
                        <button
                            onClick={handleClose}
                            className="w-full px-5 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
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

// Feedback button component for sidebar
export function FeedbackButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 hover:border-blue-200 transition-all group"
        >
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <MessageSquarePlus className="w-4 h-4" />
            </div>
            <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-slate-800">Give Feedback</span>
                <span className="text-xs text-slate-500">Help us improve</span>
            </div>
        </button>
    );
}
