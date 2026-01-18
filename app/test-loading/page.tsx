"use client";

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { LoadingTips, EXPLAINER_STEPS, PRO_TIPS } from '@/components/loading/loading-tips';

export default function TestLoadingPage() {
    const [phase, setPhase] = useState<1 | 2>(1);
    const [stepIndex, setStepIndex] = useState(0);

    const handleNext = () => {
        if (phase === 1) {
            if (stepIndex < EXPLAINER_STEPS.length - 1) {
                setStepIndex(stepIndex + 1);
            } else {
                setPhase(2);
                setStepIndex(0);
            }
        } else {
            setStepIndex((prev) => (prev + 1) % PRO_TIPS.length);
        }
    };

    const handlePrev = () => {
        if (phase === 2) {
            if (stepIndex > 0) {
                setStepIndex(stepIndex - 1);
            } else {
                setPhase(1);
                setStepIndex(EXPLAINER_STEPS.length - 1);
            }
        } else {
            if (stepIndex > 0) {
                setStepIndex(stepIndex - 1);
            }
        }
    };

    const handleReset = () => {
        setPhase(1);
        setStepIndex(0);
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            {/* Controls bar - fixed at top */}
            <div className="sticky top-0 z-50 bg-white border-b border-slate-200 p-4">
                <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h1 className="text-lg font-bold text-slate-800">Loading Tips Test</h1>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrev}
                            disabled={phase === 1 && stepIndex === 0}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>

                        <div className="flex flex-col items-center min-w-[140px]">
                            <span className="text-sm font-semibold text-slate-900">
                                Phase {phase}: {phase === 1 ? 'Explainer' : 'Pro Tips'}
                            </span>
                            <span className="text-xs text-slate-500">
                                Step {stepIndex + 1} / {phase === 1 ? EXPLAINER_STEPS.length : PRO_TIPS.length}
                            </span>
                        </div>

                        <button
                            onClick={handleNext}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                        >
                            <ArrowRight className="w-5 h-5 text-slate-600" />
                        </button>

                        <div className="hidden sm:block w-px h-8 bg-slate-200" />

                        <button
                            onClick={handleReset}
                            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading screen preview */}
            <div className="flex-1 relative">
                <LoadingTips
                    query="What is the history of machine learning?"
                    manualPhase={phase}
                    manualStepIndex={stepIndex}
                />
            </div>
        </div>
    );
}
