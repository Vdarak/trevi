"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, X, GitBranch, Layers, ArrowDown, ArrowRight, ThumbsUp, ThumbsDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreviLogoAnimation } from '@/components/ui/trevi-logo';

// ============================================================================
// Phase 1: Explainer Steps
// ============================================================================

export const EXPLAINER_STEPS = [
    {
        keyword: "Explore",
        description: "Topic you're curious about"
    },
    {
        keyword: "Branch",
        description: "Watch your ideas grow into a topic tree"
    },
    {
        keyword: "Click",
        description: "Tap any node to dive deeper"
    },
    {
        keyword: "Follow-up",
        description: "Ask curious questions"
    },
];

// ============================================================================
// Inline Component Mocks (Styled to match ACTUAL app components)
// ============================================================================

// Mock Root Node - matches concept-node.tsx root styling
const InlineRootNode = ({ label }: { label: string }) => (
    <span className="inline-flex items-center mx-1 align-middle bg-slate-900 text-white border-[3px] border-slate-900 rounded-full px-3 py-1 text-xs font-bold shadow-lg whitespace-nowrap">
        {label}
    </span>
);

// Mock Conversation/Leaf Node - matches concept-node.tsx leaf styling  
const InlineConversationNode = ({ label }: { label: string }) => (
    <span className="inline-flex items-center mx-1 align-middle bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm whitespace-nowrap">
        {label}
    </span>
);

// Mock Explore Node - matches concept-node.tsx direction node styling
const InlineExploreNode = ({ label }: { label: string }) => (
    <span className="inline-flex items-center mx-1 align-middle bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm whitespace-nowrap">
        {label}
        <Compass className="w-4 h-4 ml-1 text-blue-400" strokeWidth={2} />
    </span>
);

// Mock Delete Button (Edge) 
const InlineDeleteButton = () => (
    <span className="inline-flex items-center justify-center w-5 h-5 mx-1 align-middle bg-red-500 rounded-full shadow-md text-white">
        <X className="w-3 h-3" strokeWidth={2.5} />
    </span>
);

// Mock Toolbar Button (icon only, no label)
const InlineToolbarBtn = ({ icon: Icon, active = false }: { icon: any, active?: boolean }) => (
    <span className={cn(
        "inline-flex items-center justify-center w-8 h-8 mx-0.5 align-middle rounded border",
        active
            ? "bg-blue-50 text-blue-600 border-blue-200"
            : "bg-white text-slate-500 border-slate-200"
    )}>
        <Icon className="w-4 h-4" />
    </span>
);

// Mock Citation Badge
const InlineCitation = () => (
    <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 mx-0.5 align-baseline text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
        1
    </span>
);

// Mock Feedback Button
const InlineFeedbackBtn = ({ type }: { type: 'up' | 'down' }) => (
    <span className={cn(
        "inline-flex items-center justify-center w-8 h-8 mx-1 align-middle rounded-md transition-colors",
        type === 'up'
            ? "text-green-500 hover:text-green-600 hover:bg-green-50"
            : "text-red-400 hover:text-red-500 hover:bg-red-50"
    )}>
        {type === 'up' ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
    </span>
);

// ============================================================================
// Phase 2: Pro Tips (React Components)
// ============================================================================

const ProTip_Nodes = () => (
    <span>
        Click a <InlineRootNode label="Root" /> to see the <strong>full topic</strong>,
        a <InlineConversationNode label="Conversation" /> to <strong>read more</strong>,
        or an <InlineExploreNode label="Explore" /> to <strong>branch out</strong>.
    </span>
);

const ProTip_Delete = () => (
    <span>
        Click the <InlineDeleteButton /> on any <strong>connecting line</strong> to prune that branch and its children.
    </span>
);

const ProTip_Layout = () => (
    <span>
        Toggle between <InlineToolbarBtn icon={GitBranch} active /> <strong>spacious</strong> and <InlineToolbarBtn icon={Layers} /> <strong>compact</strong> layout.
    </span>
);

const ProTip_Direction = () => (
    <span>
        Switch between <InlineToolbarBtn icon={ArrowDown} active /> <strong>vertical</strong> and <InlineToolbarBtn icon={ArrowRight} /> <strong>horizontal</strong> tree orientation.
    </span>
);

const ProTip_Citations = () => (
    <span>
        <strong>Hover</strong> over citation badges <InlineCitation /> to preview the <strong>source snippet</strong> instantly.
    </span>
);

const ProTip_Feedback = () => (
    <span>
        <strong>Hover</strong> over <InlineFeedbackBtn type="up" /> or <InlineFeedbackBtn type="down" /> to share feedback. Trevi is in <strong>alpha</strong> — your input helps us build the best experience!
    </span>
);

export const PRO_TIPS = [
    { id: 'nodes', component: <ProTip_Nodes />, title: "Node Types" },
    { id: 'feedback', component: <ProTip_Feedback />, title: "Share Feedback" },
    { id: 'delete', component: <ProTip_Delete />, title: "Delete Branches" },
    { id: 'layout', component: <ProTip_Layout />, title: "Layout" },
    { id: 'direction', component: <ProTip_Direction />, title: "Tree Direction" },
    { id: 'citations', component: <ProTip_Citations />, title: "Citations" },
];

// ============================================================================
// Loading Dots Component
// ============================================================================

function LoadingDots() {
    return (
        <span className="inline-flex items-center ml-1">
            <motion.span
                className="w-1 h-1 bg-slate-400 rounded-full mx-0.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
            />
            <motion.span
                className="w-1 h-1 bg-slate-400 rounded-full mx-0.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
            />
            <motion.span
                className="w-1 h-1 bg-slate-400 rounded-full mx-0.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
            />
        </span>
    );
}

// ============================================================================
// Explainer Step Component (Node-styled with tooltip)
// ============================================================================

// ============================================================================
// Explainer Step Component (Node-styled with tooltip)
// ============================================================================

interface ExplainerStepProps {
    keyword: string;
    description: string;
    isActive: boolean;
    isExplained: boolean;
    canHover: boolean;
}

function ExplainerStep({ keyword, description, isActive, isExplained, canHover }: ExplainerStepProps) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (!canHover) return;
        const timeout = setTimeout(() => setShowTooltip(true), 200);
        setHoverTimeout(timeout);
    };

    const handleMouseLeave = () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        setShowTooltip(false);
    };

    // Show description when active (during Phase 1 animation)
    const shouldShowDescription = isActive || showTooltip;

    return (
        <div
            className="relative flex flex-col items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Node-styled keyword */}
            <motion.div
                animate={{
                    scale: isActive ? 1.05 : 1,
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 cursor-default",
                    isActive || isExplained
                        // Root node styling (active/explained)
                        ? "bg-slate-900 text-white border-2 border-slate-900 shadow-md"
                        // Conversation node styling (unexplained)
                        : "bg-white text-slate-500 border border-slate-200 shadow-sm"
                )}
            >
                {keyword}
            </motion.div>

            {/* Tooltip-styled description - intelligently positioned */}
            <AnimatePresence>
                {shouldShowDescription && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full mt-2 z-20 left-1/2 -translate-x-1/2"
                    >
                        {/* Tooltip arrow */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-slate-800 rotate-45" />
                        {/* Tooltip body - wider max-width for mobile readability */}
                        <div className="bg-slate-800 text-white text-xs font-medium px-3 py-2 rounded-md shadow-lg text-center w-max max-w-[280px] sm:max-w-none">
                            {description}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// Explainer Component (Phase 1 - always visible, animates sequentially)
// ============================================================================

interface ExplainerProps {
    activeStep: number;
    isCondensed: boolean;
}

function Explainer({ activeStep, isCondensed }: ExplainerProps) {
    return (
        <div className="flex flex-col items-center w-full">
            {/* About Trevi title pill */}
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-6">
                About Trevi
            </span>

            {/* Steps row - no wrap to keep arrows in line */}
            <div className="flex items-center justify-center gap-1 sm:gap-4 w-full">
                {EXPLAINER_STEPS.map((step, i) => (
                    <React.Fragment key={i}>
                        <ExplainerStep
                            keyword={step.keyword}
                            description={step.description}
                            isActive={i === activeStep && !isCondensed}
                            isExplained={i < activeStep || isCondensed}
                            canHover={i <= activeStep || isCondensed}
                        />

                        {/* Connector chevron - always visible, smaller gap on mobile */}
                        {i < EXPLAINER_STEPS.length - 1 && (
                            <ChevronRight className={cn(
                                "w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 transition-colors duration-300",
                                i < activeStep || isCondensed ? "text-slate-400" : "text-slate-200"
                            )} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// Main Loading Tips Component
// ============================================================================

interface LoadingTipsProps {
    query?: string;
    manualPhase?: 1 | 2;
    manualStepIndex?: number;
}

export function LoadingTips({ query, manualPhase, manualStepIndex }: LoadingTipsProps) {
    const [phase, setPhase] = useState<1 | 2>(1);
    const [stepIndex, setStepIndex] = useState(0);

    const currentPhase = manualPhase ?? phase;
    const currentStepIndex = manualStepIndex ?? stepIndex;

    useEffect(() => {
        if (manualPhase !== undefined) return;

        let interval: NodeJS.Timeout;

        if (phase === 1) {
            interval = setInterval(() => {
                setStepIndex(prev => {
                    if (prev < EXPLAINER_STEPS.length - 1) {
                        return prev + 1;
                    } else {
                        setPhase(2);
                        return 0;
                    }
                });
            }, 3000); // 3s per explainer step
        } else {
            interval = setInterval(() => {
                setStepIndex(prev => (prev + 1) % PRO_TIPS.length);
            }, 6000); // 6s per pro tip
        }

        return () => clearInterval(interval);
    }, [phase, manualPhase]);

    return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[500px] bg-white relative overflow-hidden px-4 py-8">
            {/* Background radial gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent opacity-60" />

            {/* Header section: Logo LEFT, Text RIGHT - always side-by-side */}
            <div className="relative z-10 flex flex-row items-center justify-center gap-4 sm:gap-6 md:gap-10 w-full max-w-3xl mx-auto mb-6">

                {/* Trevi Logo Animation - responsive sizing */}
                <div className="flex-shrink-0">
                    {/* Mobile: 80px */}
                    <div className="sm:hidden">
                        <TreviLogoAnimation size={80} />
                    </div>
                    {/* Tablet: 100px */}
                    <div className="hidden sm:block md:hidden">
                        <TreviLogoAnimation size={100} />
                    </div>
                    {/* Desktop: 140px */}
                    <div className="hidden md:block">
                        <TreviLogoAnimation size={140} />
                    </div>
                </div>

                {/* Text stacked vertically: "Trevi is exploring..." + Query */}
                <div className="flex flex-col items-start text-left gap-0.5">
                    <p className="text-xs sm:text-sm md:text-base text-slate-500 font-medium flex items-center">
                        Trevi is exploring your curiosity<LoadingDots />
                    </p>
                    {query && (
                        <p className="text-sm sm:text-base md:text-xl font-semibold text-slate-800 line-clamp-2 max-w-[200px] sm:max-w-sm md:max-w-md">
                            "{query}"
                        </p>
                    )}
                </div>
            </div>

            {/* Explainer section - centered underneath header */}
            <div className="relative z-10 w-full max-w-2xl mx-auto">
                {/* Top Separator */}
                <div className="w-full h-px bg-slate-200 mb-8" />

                <div className="pb-12"> {/* Extra padding for tooltip space */}
                    <Explainer
                        activeStep={currentPhase === 1 ? currentStepIndex : EXPLAINER_STEPS.length - 1}
                        isCondensed={currentPhase === 2}
                    />
                </div>

                {/* Bottom Separator */}
                <div className="w-full h-px bg-slate-200 mb-8" />
            </div>

            {/* Pro Tips section (Phase 2) - appears after Phase 1 */}
            <AnimatePresence>
                {currentPhase === 2 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.5 }}
                        className="relative z-10 w-full max-w-xl mx-auto"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`tip-${currentStepIndex}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.4 }}
                                className="flex flex-col items-center text-center space-y-3"
                            >
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                                    Tip: {PRO_TIPS[currentStepIndex].title}
                                </span>
                                <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                                    {PRO_TIPS[currentStepIndex].component}
                                </p>
                            </motion.div>
                        </AnimatePresence>

                        {/* Progress indicator */}
                        <div className="flex justify-center gap-1.5 mt-4">
                            {PRO_TIPS.map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                        i === currentStepIndex ? "bg-blue-500 w-4" : "bg-slate-200"
                                    )}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
