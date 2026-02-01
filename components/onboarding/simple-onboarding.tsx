"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, X, GitBranch, Layers, ArrowDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ============================================================================
// Animation Variants
// ============================================================================

const fadeUpVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: (delay: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            delay,
            ease: [0.25, 0.1, 0.25, 1] as const,
        },
    }),
};

// ============================================================================
// Local Mock Components (Self-contained)
// ============================================================================

const InlineRootNode = ({ label }: { label: string }) => (
    <span className="inline-flex items-center mx-1 align-middle bg-slate-900 text-white border-[3px] border-slate-900 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold shadow-md whitespace-nowrap">
        {label}
    </span>
);

const InlineExploreNode = ({ label }: { label: string }) => (
    <span className="inline-flex items-center mx-1 align-middle bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-slate-700 shadow-sm whitespace-nowrap">
        {label}
        {/* <Compass className="w-3 h-3 ml-1 text-blue-400" strokeWidth={2} /> */}
    </span>
);

const InlineDeleteButton = () => (
    <span className="inline-flex items-center justify-center w-5 h-5 mx-1 align-middle bg-red-500 rounded-full shadow-md text-white">
        <X className="w-3 h-3" strokeWidth={2.5} />
    </span>
);

const InlineToolbarBtn = ({ icon: Icon, active = false }: { icon: any, active?: boolean }) => (
    <span className={cn(
        "inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 mx-0.5 align-middle rounded border shadow-sm",
        active
            ? "bg-blue-50 text-blue-600 border-blue-200"
            : "bg-white text-slate-500 border-slate-200"
    )}>
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
    </span>
);

const InlineCitation = () => (
    <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 mx-0.5 align-baseline text-[10px] font-medium bg-blue-100 text-blue-700 rounded ring-1 ring-blue-200">
        1
    </span>
);

const InlineFeedbackBtn = ({ type }: { type: 'up' | 'down' }) => (
    <span className={cn(
        "inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 mx-1 align-middle rounded-md transition-colors border border-slate-100 bg-white shadow-sm",
        type === 'up'
            ? "text-green-500"
            : "text-red-400"
    )}>
        {type === 'up' ? <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ThumbsDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
    </span>
);

// ============================================================================
// Section Components
// ============================================================================

// Section 1: What is Trevi (Retained as requested)
function WhatIsTreviSection() {
    return (
        <motion.section
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            custom={0.2}
            className="w-full max-w-2xl mb-10 text-center"
        >
            <h2 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight">
                What is Trevi?
            </h2>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto">
                <strong className="text-slate-800 font-semibold">Explore</strong> any topic you're curious about.
                Watch your ideas <strong className="text-slate-800 font-semibold">branch</strong> into a topic tree.
                <strong className="text-slate-800 font-semibold">Click</strong> any node to dive deeper,
                and ask <strong className="text-slate-800 font-semibold">follow-up</strong> questions to satisfy your curiosity.
            </p>
        </motion.section>
    );
}

// Card Component
function TutorialCard({ title, children, delay }: { title: string, children: React.ReactNode, delay: number }) {
    return (
        <motion.div
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            custom={delay}
            className="group relative bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 flex flex-col items-center text-center h-full"
        >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-3">
                {title}
            </span>
            <p className="text-sm text-slate-600 leading-relaxed">
                {children}
            </p>
        </motion.div>
    );
}

// Section 2: Cards Grid
function TutorialCardsSection() {
    return (
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr mb-12">

            {/* Row 1: Explore & Prune */}
            <TutorialCard title="Explore Nodes" delay={0.4}>
                Click a <InlineRootNode label="Root" /> to see the full topic,
                or click <InlineExploreNode label="Explore" /> to branch out.
            </TutorialCard>

            <TutorialCard title="Prune Nodes" delay={0.5}>
                Click the <InlineDeleteButton /> on any connecting line to prune that branch.
            </TutorialCard>

            {/* Row 2: Layouts & Citations */}
            <TutorialCard title="Switch Layouts" delay={0.6}>
                Toggle <InlineToolbarBtn icon={GitBranch} active /> <InlineToolbarBtn icon={Layers} /> Compact
                or <InlineToolbarBtn icon={ArrowDown} active /> <InlineToolbarBtn icon={ArrowRight} /> Direction.
            </TutorialCard>

            <TutorialCard title="Citations" delay={0.7}>
                Hover over <InlineCitation /> badges to preview source snippets.
            </TutorialCard>

            {/* Row 3: Feedback (Full Width) */}
            <div className="md:col-span-2">
                <TutorialCard title="Share Feedback" delay={0.8}>
                    Hover over <InlineFeedbackBtn type="up" /> or <InlineFeedbackBtn type="down" /> to share feedback.
                    Trevi is in <strong>alpha</strong> — your input helps us build the best experience!
                </TutorialCard>
            </div>

        </div>
    );
}

// Get Started Button
function GetStartedButton() {
    return (
        <motion.div
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            custom={0.9}
            className="pb-10"
        >
            <Link
                href="/"
                className={cn(
                    "inline-flex items-center gap-2 px-8 py-4 rounded-full text-base",
                    "bg-slate-900 text-white font-bold tracking-wide",
                    "shadow-xl transition-all duration-200",
                    "hover:bg-slate-800 hover:scale-105 active:scale-95 hover:shadow-2xl hover:shadow-blue-900/10"
                )}
            >
                Get Started
                <ArrowRight className="w-5 h-5" />
            </Link>
        </motion.div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function SimpleOnboarding() {
    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center px-4 py-12 md:py-16 overflow-y-auto">
            {/* Background gradient */}
            {/* <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-blue-100/40 via-white to-white pointer-events-none" /> */}
            <div className="fixed inset-0 bg-white pointer-events-none" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/80 via-transparent to-transparent pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-3xl mx-auto">

                <WhatIsTreviSection />

                <TutorialCardsSection />

                <GetStartedButton />
            </div>
        </div>
    );
}

export default SimpleOnboarding;
