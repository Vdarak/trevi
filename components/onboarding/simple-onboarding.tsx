"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { TreviLogoStatic } from '@/components/ui/trevi-logo';
import { EXPLAINER_STEPS, PRO_TIPS } from '@/components/loading/loading-tips';
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
            ease: [0.25, 0.1, 0.25, 1],
        },
    }),
};

// ============================================================================
// Section Components
// ============================================================================

// Section 1: What is Trevi - Paragraph with bolded keywords
function WhatIsTreviSection() {
    return (
        <motion.section
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            custom={0.2}
            className="w-full max-w-xl mb-12"
        >
            <h2 className="text-xl font-bold text-slate-900 mb-4">
                What is Trevi?
            </h2>

            <p className="text-base text-slate-600 leading-relaxed">
                <strong className="text-slate-800">Explore</strong> any topic you're curious about.
                Watch your ideas <strong className="text-slate-800">branch</strong> into a topic tree.
                <strong className="text-slate-800">Click</strong> any node to dive deeper,
                and ask <strong className="text-slate-800">follow-up</strong> questions to satisfy your curiosity. Please go through the next section to learn how to use Trevi.
            </p>
        </motion.section>
    );
}

// Section 2: How to Use Trevi - Tips with inline components
function HowToUseSection() {
    return (
        <motion.section
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            custom={0.7}
            className="w-full max-w-xl mb-12"
        >
            <h2 className="text-xl font-bold text-slate-900 mb-6">
                How to Use Trevi
            </h2>

            <div className="space-y-4">
                {PRO_TIPS.map((tip, index) => (
                    <motion.div
                        key={tip.id}
                        variants={fadeUpVariant}
                        initial="hidden"
                        animate="visible"
                        custom={0.8 + index * 0.1}
                        className="py-3"
                    >
                        {/* Tip title badge */}
                        <span className="inline-block text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
                            {tip.title}
                        </span>

                        {/* Tip content with increased line height for inline components */}
                        <p className="text-sm text-slate-600 leading-[2.4]">
                            {tip.component}
                        </p>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    );
}

// Get Started Button
function GetStartedButton() {
    return (
        <motion.div
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            custom={1.4}
        >
            <Link
                href="/"
                className={cn(
                    "inline-flex items-center gap-2 px-6 py-3 rounded-full",
                    "bg-slate-900 text-white font-semibold",
                    "hover:bg-slate-800 transition-colors",
                    "shadow-lg hover:shadow-xl"
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
        <div className="min-h-screen bg-white flex flex-col items-center px-6 py-12 md:py-16 overflow-y-auto">
            {/* Background gradient */}
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
                <WhatIsTreviSection />

                <HowToUseSection />

                <GetStartedButton />
            </div>
        </div>
    );
}

export default SimpleOnboarding;
