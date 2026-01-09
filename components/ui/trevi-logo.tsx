"use client";

import React, { useEffect, useRef } from 'react';

interface TreviLogoAnimationProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// REVERSED path - starts at bottom (21.2078, 16.8104) and ends at top-right (30.5, 9.90391)
// This allows stroke-dashoffset to reveal from the same direction the ball moves
const TREVI_PATH = "M21.2078 16.8104L21.2078 29.1922C21.2078 31.019 19.7268 32.5 17.8999 32.5C16.0731 32.5 14.5921 31.019 14.5921 29.1922L14.5921 8.04607C14.5921 4.43078 11.6614 1.5 8.04607 1.5L5.70195 1.5C3.38128 1.5 1.5 3.38128 1.5 5.70196C1.5 8.02263 3.38128 9.90391 5.70195 9.90391L30.5 9.90391";

/**
 * Animated Trevi logo with ball following path animation.
 * The ball starts at the end, traces backward to reveal the path,
 * pauses dramatically with full logo visible, then traces forward to hide.
 * All animations use SVG native animations for perfect synchronization.
 */
export function TreviLogoAnimation({ size = 24, className = '', animate = true }: TreviLogoAnimationProps) {
  return (
    <div
      className={`rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.75}
        height={size * 0.8}
        viewBox="-4 -4 42 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        {/* Define the path for animation reference */}
        <defs>
          <path
            id="treviPath"
            d={TREVI_PATH}
          />
        </defs>

        {/* Animated reveal path - pathLength="1" normalizes to match ball's 0-1 keyPoints */}
        <path
          d={TREVI_PATH}
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={animate ? undefined : 0}
        >
          {animate && (
            <animate
              attributeName="stroke-dashoffset"
              values="0.99; 0.99; 0; 0; 0.99; 0.99"
              keyTimes="0; 0.15; 0.45; 0.55; 0.85; 1"
              dur="5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0 0 1 1; 0.42 0 0.58 1; 0 0 1 1; 0.42 0 0.58 1; 0 0 1 1"
            />
          )}
        </path>

        {/* Main Ball - starts at path start (bottom), moves to path end (top-right), returns */}
        {animate && (
          <circle r="0" fill="#fff">
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0; 0.15; 0.45; 0.55; 0.85; 1"
              keyPoints="0; 0; 1; 1; 0; 0"
              keySplines="0 0 1 1; 0.42 0 0.58 1; 0 0 1 1; 0.42 0 0.58 1; 0 0 1 1"
            >
              <mpath href="#treviPath" />
            </animateMotion>
            <animate
              attributeName="r"
              values="0; 3; 3; 3; 3; 0"
              keyTimes="0; 0.1; 0.15; 0.85; 0.9; 1"
              dur="5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.42 0 0.58 1; 0 0 1 1; 0 0 1 1; 0 0 1 1; 0.42 0 0.58 1"
            />
          </circle>
        )}
      </svg>
    </div>
  );
}

/**
 * Simple static Trevi logo (no animation) with ball at start
 */
export function TreviLogoStatic({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.75}
        height={size * 0.8}
        viewBox="-4 -4 42 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <path
          d="M30.5 9.90391L5.70195 9.90391C3.38128 9.90391 1.5 8.02263 1.5 5.70196C1.5 3.38128 3.38128 1.5 5.70195 1.5L8.04607 1.5C11.6614 1.5 14.5921 4.43078 14.5921 8.04607L14.5921 29.1922C14.5921 31.019 16.0731 32.5 17.8999 32.5C19.7268 32.5 21.2078 31.019 21.2078 29.1922L21.2078 16.8104"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* Ball at the start of the path */}
        <circle cx="30.5" cy="9.90391" r="3" fill="currentColor" />
      </svg>
    </div>
  );
}

/**
 * Simple spinner for loading states
 */
export function TreviSpinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default TreviLogoAnimation;
