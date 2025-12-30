"use client";

import React, { useEffect, useState } from 'react';

interface AnimatedNode {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  opacity: number;
  delay: number;
}

const loadingMessages = [
  "Trevi is thinking...",
  "Creating your graph...",
  "Organizing knowledge...",
  "Connecting ideas...",
  "Building connections...",
];

export function GraphLoading() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState<'expand' | 'hold' | 'contract'>('expand');

  // Cycle through messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Cycle through animation phases
  useEffect(() => {
    const phases: Array<'expand' | 'hold' | 'contract'> = ['expand', 'hold', 'contract'];
    let currentPhase = 0;

    const cycle = () => {
      currentPhase = (currentPhase + 1) % 3;
      setPhase(phases[currentPhase]);
    };

    const interval = setInterval(cycle, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-white">
      {/* Animated Graph SVG */}
      <div className="relative w-80 h-80 mb-8">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
        >
          <defs>
            {/* Gradient for edges */}
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#64748b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.3" />
            </linearGradient>

            {/* Glow filter for nodes */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Center root node */}
          <circle
            cx="100"
            cy="100"
            r="8"
            className="fill-slate-800"
            filter="url(#glow)"
          />

          {/* Animated branches - Level 1 */}
          {[0, 72, 144, 216, 288].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const expandedX = 100 + Math.cos(rad) * 45;
            const expandedY = 100 + Math.sin(rad) * 45;
            const contractedX = 100 + Math.cos(rad) * 8;
            const contractedY = 100 + Math.sin(rad) * 8;

            const targetX = phase === 'contract' ? contractedX : expandedX;
            const targetY = phase === 'contract' ? contractedY : expandedY;

            return (
              <g key={`l1-${i}`}>
                {/* Edge */}
                <line
                  x1="100"
                  y1="100"
                  x2={targetX}
                  y2={targetY}
                  stroke="url(#edgeGradient)"
                  strokeWidth="2"
                  className="transition-all duration-[1500ms] ease-in-out"
                  style={{
                    transitionDelay: `${i * 80}ms`,
                    opacity: phase === 'contract' ? 0.3 : 0.8
                  }}
                />
                {/* Node */}
                <circle
                  cx={targetX}
                  cy={targetY}
                  r={phase === 'contract' ? 3 : 5}
                  className="fill-slate-600 transition-all duration-[1500ms] ease-in-out"
                  style={{
                    transitionDelay: `${i * 80}ms`,
                    opacity: phase === 'contract' ? 0.4 : 1
                  }}
                />
              </g>
            );
          })}

          {/* Animated branches - Level 2 */}
          {[0, 72, 144, 216, 288].map((baseAngle, i) => {
            const offsets = [-25, 25];
            return offsets.map((offset, j) => {
              const angle = baseAngle + offset;
              const rad = (angle * Math.PI) / 180;
              const parentRad = (baseAngle * Math.PI) / 180;

              const parentX = 100 + Math.cos(parentRad) * 45;
              const parentY = 100 + Math.sin(parentRad) * 45;
              const expandedX = 100 + Math.cos(rad) * 75;
              const expandedY = 100 + Math.sin(rad) * 75;

              const isExpanded = phase === 'expand' || phase === 'hold';
              const targetX = isExpanded ? expandedX : parentX;
              const targetY = isExpanded ? expandedY : parentY;
              const parentTargetX = phase === 'contract' ? 100 : parentX;
              const parentTargetY = phase === 'contract' ? 100 : parentY;

              return (
                <g key={`l2-${i}-${j}`}>
                  {/* Edge */}
                  <line
                    x1={parentTargetX}
                    y1={parentTargetY}
                    x2={targetX}
                    y2={targetY}
                    stroke="url(#edgeGradient)"
                    strokeWidth="1.5"
                    className="transition-all duration-[1500ms] ease-in-out"
                    style={{
                      transitionDelay: `${(i * 2 + j) * 60 + 200}ms`,
                      opacity: phase === 'contract' ? 0 : phase === 'hold' ? 0.7 : 0.5
                    }}
                  />
                  {/* Node */}
                  <circle
                    cx={targetX}
                    cy={targetY}
                    r={phase === 'contract' ? 0 : 4}
                    className="fill-slate-500 transition-all duration-[1500ms] ease-in-out"
                    style={{
                      transitionDelay: `${(i * 2 + j) * 60 + 200}ms`,
                      opacity: phase === 'contract' ? 0 : 0.9
                    }}
                  />
                </g>
              );
            });
          })}

          {/* Animated branches - Level 3 (outermost) */}
          {[0, 72, 144, 216, 288].map((baseAngle, i) => {
            const offsets = [-35, 0, 35];
            return offsets.map((offset, j) => {
              const angle = baseAngle + offset;
              const rad = (angle * Math.PI) / 180;
              const parentRad = ((baseAngle + (offset > 0 ? 25 : offset < 0 ? -25 : 0)) * Math.PI) / 180;

              const parentX = 100 + Math.cos(parentRad) * 75;
              const parentY = 100 + Math.sin(parentRad) * 75;
              const expandedX = 100 + Math.cos(rad) * 95;
              const expandedY = 100 + Math.sin(rad) * 95;

              const isFullyExpanded = phase === 'hold';
              const targetX = isFullyExpanded ? expandedX : parentX;
              const targetY = isFullyExpanded ? expandedY : parentY;

              return (
                <g key={`l3-${i}-${j}`}>
                  {/* Edge */}
                  <line
                    x1={parentX}
                    y1={parentY}
                    x2={targetX}
                    y2={targetY}
                    stroke="url(#edgeGradient)"
                    strokeWidth="1"
                    className="transition-all duration-[1200ms] ease-in-out"
                    style={{
                      transitionDelay: `${(i * 3 + j) * 40 + 400}ms`,
                      opacity: isFullyExpanded ? 0.5 : 0
                    }}
                  />
                  {/* Node */}
                  <circle
                    cx={targetX}
                    cy={targetY}
                    r={isFullyExpanded ? 3 : 0}
                    className="fill-slate-400 transition-all duration-[1200ms] ease-in-out"
                    style={{
                      transitionDelay: `${(i * 3 + j) * 40 + 400}ms`,
                      opacity: isFullyExpanded ? 0.8 : 0
                    }}
                  />
                </g>
              );
            });
          })}
        </svg>
      </div>

      {/* Loading message with fade transition */}
      <div className="text-center">
        <p
          key={messageIndex}
          className="text-xl font-medium text-slate-700 animate-fade-in"
        >
          {loadingMessages[messageIndex]}
        </p>
        <div className="flex justify-center gap-1 mt-4">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
