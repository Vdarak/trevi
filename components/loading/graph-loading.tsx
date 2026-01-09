"use client";

import React, { useEffect, useState } from 'react';
import { TreviLogoAnimation } from '@/components/ui/trevi-logo';

const loadingMessages = [
  "Trevi is thinking...",
  "Creating your topic tree...",
  "Organizing knowledge...",
  "Connecting ideas...",
  "Building connections...",
  "Almost there...",
  "Creating your topic tree...", // Final message
];

// Cycle interval: ~60 seconds / 7 messages ≈ 8.5 seconds per message
const MESSAGE_INTERVAL = 8500;

export function GraphLoading() {
  const [messageIndex, setMessageIndex] = useState(0);

  // Cycle through messages, stopping at the last one
  useEffect(() => {
    if (messageIndex >= loadingMessages.length - 1) return; // Stop at final message
    
    const timeout = setTimeout(() => {
      setMessageIndex((prev) => Math.min(prev + 1, loadingMessages.length - 1));
    }, MESSAGE_INTERVAL);
    return () => clearTimeout(timeout);
  }, [messageIndex]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-background">
      {/* Trevi Logo Animation - Responsive sizing */}
      <div className="mb-8">
        {/* Mobile: 40dvw (dynamic viewport width), capped at 200px */}
        <div className="md:hidden" style={{ width: 'min(40dvw, 200px)', height: 'min(40dvw, 200px)' }}>
          <TreviLogoAnimation size={200} />
        </div>
        {/* Desktop: 300px */}
        <div className="hidden md:block">
          <TreviLogoAnimation size={300} />
        </div>
      </div>

      {/* Loading message with fade transition */}
      <div className="text-center">
        <p
          key={messageIndex}
          className="text-xl font-medium text-foreground animate-fade-in"
        >
          {loadingMessages[messageIndex]}
        </p>
      </div>
    </div>
  );
}
