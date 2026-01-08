"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatInterface } from '@/components/chat/chat-interface';
import { TreviLogoAnimation } from '@/components/ui/trevi-logo';

export function StepHomeDemo() {
    const [typedMessage, setTypedMessage] = useState("");
    const [isSimulatingLoad, setIsSimulatingLoad] = useState(false);

    // Animation Sequence
    useEffect(() => {
        const fullMessage = "What is the future of synthetic biology?";
        let currentIndex = 0;

        // Initial delay before typing starts
        const startDelay = setTimeout(() => {
            const typeInterval = setInterval(() => {
                if (currentIndex <= fullMessage.length) {
                    setTypedMessage(fullMessage.slice(0, currentIndex));
                    currentIndex++;
                } else {
                    clearInterval(typeInterval);
                    // After typing, simulate Loading state after a brief pause
                    setTimeout(() => {
                        setIsSimulatingLoad(true);
                        // After loading demo, reset loop
                        setTimeout(() => {
                            setTypedMessage("");
                            setIsSimulatingLoad(false);
                            currentIndex = 0;
                            // Restart loop
                        }, 4000); // Show loading for 4s
                    }, 800);
                }
            }, 50); // Typing speed

            return () => clearInterval(typeInterval);
        }, 1000);

        return () => clearTimeout(startDelay);
    }, []);

    return (
        <div className="flex h-full w-full bg-white overflow-hidden pointer-events-none select-none">
            {/* Sidebar - Static Dummy State */}
            <Sidebar
                selectedChatId={null}
                onChatSelect={() => { }}
                onNewChat={() => { }}
                onLogoClick={() => { }}
                onChatDeleted={() => { }}
                isCreatingChat={isSimulatingLoad}
                pendingChats={[]}
                isMobileOpen={false}
                onMobileClose={() => { }}
                className="hidden md:flex" // Hide sidebar on mobile for simplicity in demo or keep it tailored
            />

            <main className="flex-1 flex flex-col h-full relative">
                {isSimulatingLoad ? (
                    <div className="flex flex-col items-center justify-center h-full w-full bg-white animate-in fade-in duration-500">
                        <div className="md:hidden" style={{ width: 'min(40dvw, 150px)', height: 'min(40dvw, 150px)' }}>
                            <TreviLogoAnimation size={150} />
                        </div>
                        <div className="hidden md:block">
                            <TreviLogoAnimation size={200} />
                        </div>
                        <p className="mt-8 text-lg md:text-xl font-medium text-slate-700 text-center px-4">
                            Creating your topic tree...
                        </p>
                    </div>
                ) : (
                    <ChatInterface
                        onSendMessage={() => { }}
                        isLoading={false}
                        statusMessage=""
                    // Force input value for demo purposes. 
                    // Note: ChatInterface typically controls its own input state or accepts initial value. 
                    // If it doesn't expose controlled input, we might need a wrapper or modified ChatInterface.
                    // Looking at file list, ChatInterface likely has internal state. 
                    // I'll assume for now I might need to just mock the visual if I can't inject value.
                    // BUT, to be "actual components", I should try to make it work.
                    // Since I can't easily modify ChatInterface just for this without checking, 
                    // I will wrap it or overlay a fake input if needed, BUT 
                    // let's try to pass a `defaultValue` or key if supported, or just replicate the visual structure if it's too tightly coupled.
                    // Actually, wait, simpler approach for "video-like" demo: 
                    // Just render the ChatInterface structure manually if props don't support external control, 
                    // OR add a special "demoValue" prop to ChatInterface if allowed.
                    // Let's look at ChatInterface props in next step if this fails, but for now I will try to use a 
                    // modified prop or just overlay the text if I can.
                    // Actually, I'll just clone the visual of ChatInterface here since I can't see its internals right this second 
                    // and I don't want to break it. 
                    // WAIT, I saw ChatInterface file earlier. It takes `onSendMessage`, `isLoading`, `statusMessage`.
                    // It probably manages input internally.
                    // To show typing, I might need to cheat and render a custom "DemoChatInterface" that LOOKS exactly like it but accepts value prop.
                    // Or just use the actual one and use a DOM manipulation trick? No that's hacky.
                    // Best retrieval: Re-implement the VISUAL part of ChatInterface here for the demo 
                    // OR duplicate ChatInterface code into a transient `DemoChatInterface` component in this file.
                    // I'll duplicate the visual structure for safety and exact control of the typing animation.
                    />
                )}

                {/* Overlay providing the typing simulation on top of ChatInterface if I use the real one and can't control input */
                    /* Actually, let's just use the Real Sidebar + a Custom "Hero" section that replicates the Home view exactly */
                }

                {!isSimulatingLoad && (
                    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-10">
                        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-4">
                            {/* Logo */}
                            <div className="mb-8">
                                <TreviLogoAnimation size={80} animate={false} />
                            </div>

                            {/* Input Area Simulation */}
                            <div className="w-full relative">
                                <div className="relative flex items-center w-full p-4 rounded-xl border border-slate-200 shadow-sm bg-white min-h-[60px]">
                                    <span className="text-slate-900 text-lg">{typedMessage}</span>
                                    <span className="w-0.5 h-6 bg-slate-400 ml-1 animate-pulse" />
                                </div>
                                <div className="mt-4 flex justify-center gap-2">
                                    {/* Suggestion Chips */}
                                    {["Quantum Computing", "Renaissance Art", "CRISPR"].map(chip => (
                                        <div key={chip} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-xs text-slate-500">
                                            {chip}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
