"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { StepHomeDemo } from './step-home-demo';
import { StepGraphDemo } from './step-graph-demo';
import { StepSidebarDemo } from './step-sidebar-demo';

interface OnboardingTourProps {
    onComplete: () => void;
    onSkip: () => void;
}

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const steps = [
        {
            id: 'home',
            title: 'Start your journey',
            description: 'Type any topic to begin exploring. Trevi builds a topic tree just for you.',
            component: StepHomeDemo,
        },
        {
            id: 'graph',
            title: 'Navigate your space',
            description: 'Interact with nodes to expand your topic tree. Zoom, pan, and reorganize your view.',
            component: StepGraphDemo,
        },
        {
            id: 'sidebar',
            title: 'Deep dive details',
            description: 'Chat with specific nodes and view verified sources in the bibliography.',
            component: StepSidebarDemo,
        },
    ];

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const CurrentStepComponent = steps[currentStep].component;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-500">
            {/* Top Bar with Progress */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    {/* Logo or Brand mark could go here */}
                    <div className="flex gap-1">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-8 bg-slate-900' :
                                    idx < currentStep ? 'w-2 bg-slate-300' : 'w-2 bg-slate-100'
                                    }`}
                            />
                        ))}
                    </div>
                    <span className="text-sm font-medium text-slate-500">
                        Step {currentStep + 1} of {steps.length}
                    </span>
                </div>

                <Button variant="ghost" size="sm" onClick={onSkip} className="text-slate-400 hover:text-slate-900">
                    Skip Tour
                    <X className="ml-2 w-4 h-4" />
                </Button>
            </div>

            {/* Main Content - The Demo Component */}
            <div className="flex-1 relative overflow-hidden bg-slate-50">
                <CurrentStepComponent />

                {/* Overlay Explainer Card - Positioned at bottom center or adaptable */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-6 rounded-2xl shadow-2xl pointer-events-auto flex flex-col gap-4 animate-in slide-in-from-bottom-10 duration-500">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                {steps[currentStep].title}
                            </h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                {steps[currentStep].description}
                            </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleBack}
                                disabled={currentStep === 0}
                                className="text-slate-600"
                            >
                                <ArrowLeft className="mr-2 w-4 h-4" />
                                Back
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleNext}
                                className="bg-slate-900 text-white hover:bg-slate-800"
                            >
                                {currentStep === steps.length - 1 ? "Start Exploring" : "Next"}
                                {currentStep < steps.length - 1 && <ArrowRight className="ml-2 w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
