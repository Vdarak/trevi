"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, X, GitBranch, Layers, ArrowDown, ArrowRight, ThumbsUp, ThumbsDown, ChevronRight, CheckCircle2 } from 'lucide-react';
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
// Typewriter Transition Component (Handles Delete -> Type Sequence)
// ============================================================================

interface TypewriterTransitionProps {
    initialText: string;
    finalText?: string;
    startTransition: boolean;
    className?: string; // Base classes
    initialClassName?: string; // Classes for initial text (e.g. text-blue-600)
    finalClassName?: string; // Classes for final text (e.g. text-green-600)
    children?: React.ReactNode; // Optional children (like LoadingDots) to append to initialText
    onTypingComplete?: () => void;
    onInitialTypingComplete?: () => void;
}

function TypewriterTransition({
    initialText,
    finalText,
    startTransition,
    className,
    initialClassName,
    finalClassName,
    children,
    onTypingComplete,
    onInitialTypingComplete
}: TypewriterTransitionProps) {
    // Phases: INIT_TYPING -> WAIT -> DELETING -> TYPING_FINAL -> DONE
    const [phase, setPhase] = useState<'INIT_TYPING' | 'WAIT' | 'DELETING' | 'TYPING_FINAL' | 'DONE'>('INIT_TYPING');
    const [charIndex, setCharIndex] = useState(0);

    // Initial Typing Effect (Type in initialText)
    useEffect(() => {
        setCharIndex(0);
        setPhase('INIT_TYPING');

        const timer = setInterval(() => {
            setCharIndex(prev => {
                if (prev < initialText.length) {
                    return prev + 1;
                } else {
                    clearInterval(timer);
                    setPhase('WAIT');
                    return prev;
                }
            });
        }, 30); // Fast initial typing

        return () => clearInterval(timer);
    }, [initialText]);

    // Handle initial typing completion
    useEffect(() => {
        if (phase === 'WAIT' && onInitialTypingComplete) {
            onInitialTypingComplete();
        }
    }, [phase, onInitialTypingComplete]);

    // Handle Transition Trigger
    useEffect(() => {
        if (startTransition && phase === 'WAIT' && finalText) {
            setPhase('DELETING');
        }
    }, [startTransition, phase, finalText]);

    // Deleting Effect
    useEffect(() => {
        if (phase !== 'DELETING') return;

        const timer = setInterval(() => {
            setCharIndex(prev => {
                if (prev > 0) {
                    return prev - 1;
                } else {
                    clearInterval(timer);
                    // Introduce small pause before typing new text
                    setTimeout(() => {
                        setPhase('TYPING_FINAL');
                        setCharIndex(0); // Reset for new text
                    }, 300);
                    return 0;
                }
            });
        }, 20); // Fast deletion

        return () => clearInterval(timer);
    }, [phase]);

    // Final Typing Effect
    useEffect(() => {
        if (phase !== 'TYPING_FINAL' || !finalText) return;

        const timer = setInterval(() => {
            setCharIndex(prev => {
                if (prev < finalText.length) {
                    return prev + 1;
                } else {
                    clearInterval(timer);
                    setPhase('DONE');
                    return prev;
                }
            });
        }, 40); // Normal typing speed

        return () => clearInterval(timer);
    }, [phase, finalText]);

    // Handle final typing completion
    useEffect(() => {
        if (phase === 'DONE' && onTypingComplete) {
            onTypingComplete();
        }
    }, [phase, onTypingComplete]);

    // Compute displayed text based on phase and index
    const getDisplayedText = () => {
        if (phase === 'INIT_TYPING' || phase === 'WAIT' || phase === 'DELETING') {
            return initialText.slice(0, charIndex);
        } else if ((phase === 'TYPING_FINAL' || phase === 'DONE') && finalText) {
            return finalText.slice(0, charIndex);
        }
        return "";
    };

    const isCursorVisible = phase === 'INIT_TYPING' || phase === 'DELETING' || phase === 'TYPING_FINAL';
    const isWaiting = phase === 'WAIT';

    // Determine active class based on phase (for color sync)
    const activeClass = (phase === 'TYPING_FINAL' || phase === 'DONE')
        ? finalClassName
        : initialClassName;

    return (
        <span className={cn(className, activeClass)}>
            {getDisplayedText()}
            {/* Show children (LoadingDots) only if we are in initial phases and text is full */}
            {isWaiting && children}
            {/* Cursor */}
            {isCursorVisible && (
                <span className="inline-block w-[2px] h-[1em] bg-blue-500 animate-pulse ml-0.5 align-middle" />
            )}
        </span>
    );
}

// ============================================================================
// Loading Dots Component
// ============================================================================

function LoadingDots() {
    return (
        <span className="inline-flex items-center ml-1">
            <motion.span
                className="w-1 h-1 bg-blue-400 rounded-full mx-0.5" // Updated to blue to match requested style
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
            />
            <motion.span
                className="w-1 h-1 bg-blue-400 rounded-full mx-0.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
            />
            <motion.span
                className="w-1 h-1 bg-blue-400 rounded-full mx-0.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
            />
        </span>
    );
}

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

    // Auto-show tooltip logic for entrance animation
    useEffect(() => {
        if (isActive) {
            // "once explore appears then after that the tooltip"
            // Wait 500ms after active (keyword entrance) before showing tooltip
            const timer = setTimeout(() => {
                setShowTooltip(true);
            }, 600);
            return () => clearTimeout(timer);
        } else {
            setShowTooltip(false);
        }
    }, [isActive]);

    // Manual hover support (only if canHover is true and not actively animating entrance)
    const handleMouseEnter = () => {
        if (canHover && !isActive) setShowTooltip(true);
    };

    const handleMouseLeave = () => {
        if (!isActive) setShowTooltip(false);
    };

    return (
        <div
            className="relative flex flex-col items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Node-styled keyword */}
            <motion.div
                initial={false}
                animate={{
                    scale: isActive ? 1.1 : 1,
                    y: isActive ? -2 : 0
                }}
                transition={{ duration: 0.4, type: "spring" }}
                className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 cursor-default",
                    isActive || isExplained
                        // Root node styling (active/explained)
                        ? "bg-slate-900 text-white border-2 border-slate-900 shadow-md"
                        // Conversation node styling (unexplained) - Stabilized with border-2 to prevent layout jump
                        : "bg-white text-slate-500 border-2 border-slate-200 shadow-sm"
                )}
            >
                {keyword}
            </motion.div>

            {/* Tooltip-styled description - intelligently positioned */}
            <AnimatePresence>
                {showTooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.9 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="absolute top-full mt-3 z-20 left-1/2 -translate-x-1/2"
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
// Explainer Component (Phase 1)
// ============================================================================

interface ExplainerProps {
    activeStep: number;
    isCondensed: boolean;
}

function Explainer({ activeStep, isCondensed }: ExplainerProps) {
    return (
        <div className="flex flex-col items-center w-full">
            {/* About Trevi title pill */}
            <motion.span
                className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-6"
            >
                About Trevi
            </motion.span>

            {/* Steps row */}
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

                        {/* Connector chevron */}
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

export interface LoadingTipsProps {
    query?: string;
    manualPhase?: 1 | 2;
    manualStepIndex?: number;
    isFinished?: boolean;
    isError?: boolean;
    errorMessage?: string;
    onTransitionComplete?: () => void;
}

export function LoadingTips({ query, manualPhase, manualStepIndex, isFinished, isError, errorMessage, onTransitionComplete }: LoadingTipsProps) {
    const [phase, setPhase] = useState<1 | 2>(1);
    const [stepIndex, setStepIndex] = useState(0);
    const [hasStarted, setHasStarted] = useState(false);

    // Typing state tracking for coordinated start
    const [headerTyped, setHeaderTyped] = useState(false);
    const [queryTyped, setQueryTyped] = useState(false);

    // Green check success state OR Red X error state
    const [showSuccessCheck, setShowSuccessCheck] = useState(false);
    const [showErrorX, setShowErrorX] = useState(false);

    // Persist query to prevent flicker
    const [keptQuery, setKeptQuery] = useState(query);
    useEffect(() => {
        if (query) setKeptQuery(query);
    }, [query]);

    // Initial Start Logic: Wait for BOTH typing animations to complete
    useEffect(() => {
        if (headerTyped && queryTyped && !hasStarted) {
            // "Appear briefly after typing has finished"
            const timer = setTimeout(() => {
                setHasStarted(true);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [headerTyped, queryTyped, hasStarted]);

    // Phase/Step progression
    useEffect(() => {
        if (manualPhase !== undefined || !hasStarted || isFinished) return;

        let interval: NodeJS.Timeout;

        if (phase === 1) {
            // Phase 1: 3s per step
            interval = setInterval(() => {
                setStepIndex(prev => {
                    if (prev < EXPLAINER_STEPS.length - 1) {
                        return prev + 1;
                    } else {
                        setPhase(2);
                        return 0;
                    }
                });
            }, 3000);
        } else {
            // Phase 2: 6s per tip
            interval = setInterval(() => {
                setStepIndex(prev => (prev + 1) % PRO_TIPS.length);
            }, 6000);
        }

        return () => clearInterval(interval);
    }, [phase, manualPhase, hasStarted, isFinished]);

    // ============================================================================
    // Exit Animation Orchestration
    // ============================================================================

    // States for sequence: TIPS -> EXPLAINER -> TEXT -> CHECK/ERROR -> COMPLETED
    const [exitStep, setExitStep] = useState<'LOADING' | 'FADE_TIPS' | 'FADE_EXPLAINER' | 'TRANSITION_TEXT' | 'SHOW_CHECK' | 'SHOW_ERROR' | 'COMPLETED'>('LOADING');

    // Trigger exact sequence when isFinished OR isError becomes true
    useEffect(() => {
        if ((isFinished || isError) && exitStep === 'LOADING') {
            setExitStep('FADE_TIPS');
        }
    }, [isFinished, isError, exitStep]);

    // Step 1: Fade Tips (Immediate) -> Wait 500ms
    useEffect(() => {
        if (exitStep === 'FADE_TIPS') {
            const timer = setTimeout(() => {
                setExitStep('FADE_EXPLAINER');
            }, 500); // 500ms after tips start fading
            return () => clearTimeout(timer);
        }
    }, [exitStep]);

    // Step 2: Fade Explainer -> Wait 600ms
    useEffect(() => {
        if (exitStep === 'FADE_EXPLAINER') {
            const timer = setTimeout(() => {
                setExitStep('TRANSITION_TEXT');
            }, 800); // 800ms wait for fade out
            return () => clearTimeout(timer);
        }
    }, [exitStep]);

    // Step 3: Transition Text -> Handled by TypewriterTransition internally.
    const handleTypingComplete = () => {
        if (exitStep === 'TRANSITION_TEXT') {
            if (isError) {
                // Trigger Red X Animation
                setExitStep('SHOW_ERROR');
                setShowErrorX(true);

                // Wait 1.5s then revert to home
                setTimeout(() => {
                    setExitStep('COMPLETED');
                    if (onTransitionComplete) onTransitionComplete();
                }, 1500);
            } else {
                // Trigger Green Check Animation (success path)
                setExitStep('SHOW_CHECK');
                setShowSuccessCheck(true);

                // Wait for check animation to play out (2s for nice view)
                setTimeout(() => {
                    setExitStep('COMPLETED');
                    if (onTransitionComplete) onTransitionComplete();
                }, 2000);
            }
        }
    };

    // Derived visibility flags
    const currentPhase = manualPhase ?? phase;
    const currentStepIndex = manualStepIndex ?? stepIndex;

    const showTips = exitStep === 'LOADING'; // Hide immediately on FADE_TIPS
    const showExplainer = exitStep === 'LOADING' || exitStep === 'FADE_TIPS'; // Hide on FADE_EXPLAINER
    const showTextTransition = exitStep === 'TRANSITION_TEXT' || exitStep === 'SHOW_CHECK' || exitStep === 'SHOW_ERROR'; // Keep text while icon shows

    // UI Logic
    const showingPhase1 = hasStarted && currentPhase === 1 && showExplainer;
    const showingPhase2 = hasStarted && currentPhase === 2 && showTips;
    const showingCondensedPhase1 = hasStarted && currentPhase === 2 && showExplainer;

    return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[500px] bg-white relative overflow-hidden px-4 py-8">
            {/* Background radial gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent opacity-60" />

            {/* Header section */}
            <div className="relative z-10 flex flex-row items-center justify-center gap-4 sm:gap-6 md:gap-10 w-full max-w-3xl mx-auto mb-6">

                {/* Animated Logo / Check / Error X Swap */}
                <div className="flex-shrink-0 relative w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] md:w-[140px] md:h-[140px] flex items-center justify-center">
                    <AnimatePresence mode="wait">
                        {!showSuccessCheck && !showErrorX ? (
                            <motion.div
                                key="logo"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <div className="sm:hidden transform scale-100"><TreviLogoAnimation size={80} /></div>
                                <div className="hidden sm:block md:hidden transform scale-100"><TreviLogoAnimation size={100} /></div>
                                <div className="hidden md:block transform scale-100"><TreviLogoAnimation size={140} /></div>
                            </motion.div>
                        ) : showSuccessCheck ? (
                            <motion.div
                                key="check"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ duration: 0.6, type: "spring", bounce: 0.5 }}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <CheckCircle2 className="w-full h-full text-green-500" strokeWidth={1.5} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="error"
                                initial={{ scale: 0.5, opacity: 0, rotate: 0 }}
                                animate={{ scale: 1, opacity: 1, rotate: 90 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <X className="w-full h-full text-red-500 p-4" strokeWidth={2} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Text stacked vertically */}
                <div className="flex flex-col items-start text-left gap-0.5 min-w-[200px]">
                    <div className="h-6 flex items-center">
                        <TypewriterTransition
                            initialText="Trevi is exploring your curiosity"
                            finalText={isError ? "Trevi encountered an error" : "Trevi has finished exploring"}
                            initialClassName="text-blue-600"
                            finalClassName={isError ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}
                            className="text-xs sm:text-sm md:text-base font-medium flex items-center transition-colors duration-500" // Base classes
                            startTransition={showTextTransition && !showSuccessCheck && !showErrorX} // Pause/stop transition if icon is showing
                            onInitialTypingComplete={() => setHeaderTyped(true)}
                            onTypingComplete={handleTypingComplete}
                        >
                            <LoadingDots />
                        </TypewriterTransition>
                    </div>
                    <div className="min-h-[1.5em] flex items-center">
                        {isError && showErrorX ? (
                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs sm:text-sm md:text-base text-red-600 font-medium"
                            >
                                {errorMessage || "It's not your fault"}
                            </motion.p>
                        ) : (
                            <p className="text-sm sm:text-base md:text-xl font-semibold text-slate-800 line-clamp-2 max-w-[200px] sm:max-w-sm md:max-w-md">
                                <TypewriterTransition
                                    initialText={keptQuery ? `"${keptQuery}"` : ""}
                                    startTransition={false} // Never transition away
                                    className="text-slate-800"
                                    onInitialTypingComplete={() => setQueryTyped(true)}
                                />
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Explainer section - Phase 1 */}
            <AnimatePresence>
                {(showingPhase1 || showingCondensedPhase1) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.6 }} // Match 800ms wait with slightly faster animation
                        className="relative z-10 w-full max-w-2xl mx-auto"
                    >
                        {/* Top Separator */}
                        <div className="w-full h-px bg-slate-200 mb-8" />

                        <div className="pb-12">
                            <Explainer
                                activeStep={currentPhase === 1 ? currentStepIndex : EXPLAINER_STEPS.length - 1}
                                isCondensed={currentPhase === 2}
                            />
                        </div>

                        {/* Bottom Separator */}
                        <div className="w-full h-px bg-slate-200 mb-8" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pro Tips section (Phase 2) */}
            <AnimatePresence>
                {showingPhase2 && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.5 }} // Match 500ms wait
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
