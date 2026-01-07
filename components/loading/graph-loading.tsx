"use client";

import React, { useEffect, useState } from 'react';
import { TreviLogoAnimation } from '@/components/ui/trevi-logo';

const loadingMessages = [
  "Trevi is thinking...",
  "Creating your graph...",
  "Organizing knowledge...",
  "Connecting ideas...",
  "Building connections...",
];

export function GraphLoading() {
  const [messageIndex, setMessageIndex] = useState(0);

  // Cycle through messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-white">
      {/* Trevi Logo Animation - Large */}
      <div className="mb-8">
        <TreviLogoAnimation size={300} />
      </div>

      {/* Loading message with fade transition */}
      <div className="text-center">
        <p
          key={messageIndex}
          className="text-xl font-medium text-slate-700 animate-fade-in"
        >
          {loadingMessages[messageIndex]}
        </p>
      </div>
    </div>
  );
}
