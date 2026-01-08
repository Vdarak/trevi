"use client";

import React, { useEffect, useRef } from 'react';

interface TreviLogoAnimationProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

/**
 * Animated Trevi logo with ball following path animation.
 * The path reveals as the ball moves forward and hides as it moves back.
 */
export function TreviLogoAnimation({ size = 24, className = '', animate = true }: TreviLogoAnimationProps) {
  const revealPathRef = useRef<SVGPathElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) return;

    const revealPath = revealPathRef.current;
    if (!revealPath) return;

    // Get the exact path length
    const pathLength = revealPath.getTotalLength();

    // Set up the reveal path with correct dasharray
    revealPath.style.strokeDasharray = String(pathLength);
    revealPath.style.strokeDashoffset = String(pathLength);

    // Cubic bezier function to match SVG keySplines (0.42, 0, 0.58, 1)
    function cubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
      function bezierPoint(t: number, p1: number, p2: number): number {
        const cx = 3 * p1;
        const bx = 3 * (p2 - p1) - cx;
        const ax = 1 - cx - bx;
        return ((ax * t + bx) * t + cx) * t;
      }

      function bezierDerivative(t: number, p1: number, p2: number): number {
        const cx = 3 * p1;
        const bx = 3 * (p2 - p1) - cx;
        const ax = 1 - cx - bx;
        return (3 * ax * t + 2 * bx) * t + cx;
      }

      let x = t;
      for (let i = 0; i < 8; i++) {
        const currentX = bezierPoint(x, p1x, p2x) - t;
        if (Math.abs(currentX) < 0.001) break;
        const dx = bezierDerivative(x, p1x, p2x);
        if (Math.abs(dx) < 0.001) break;
        x -= currentX / dx;
      }
      return bezierPoint(x, p1y, p2y);
    }

    const duration = 5000; // 5s total
    let startTime: number | null = null;

    function animateFrame(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) % duration;
      const progress = elapsed / duration;

      let dashOffset: number;

      if (progress < 0.15) {
        // Hidden phase (ball stationary at start)
        dashOffset = pathLength;
      } else if (progress < 0.45) {
        // Reveal phase (ball moving forward: 15% -> 45%)
        const segmentProgress = (progress - 0.15) / (0.45 - 0.15);
        const eased = cubicBezier(segmentProgress, 0.42, 0, 0.58, 1);
        dashOffset = pathLength * (1 - eased);
      } else if (progress < 0.55) {
        // DRAMATIC PAUSE at end - stroke fully revealed
        dashOffset = 0;
      } else if (progress < 0.85) {
        // Hide phase (ball moving back: 55% -> 85%)
        const segmentProgress = (progress - 0.55) / (0.85 - 0.55);
        const eased = cubicBezier(segmentProgress, 0.42, 0, 0.58, 1);
        dashOffset = pathLength * eased;
      } else {
        // Hidden phase (ball stationary at start, disappearing)
        dashOffset = pathLength;
      }

      if (revealPath) {
        revealPath.style.strokeDashoffset = String(dashOffset);
      }
      animationRef.current = requestAnimationFrame(animateFrame);
    }

    animationRef.current = requestAnimationFrame(animateFrame);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Scale factor based on original viewBox (42x42 with -4,-4 offset)
  const scale = size / 34;

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
            d="M30.5 9.90391L5.70195 9.90391C3.38128 9.90391 1.5 8.02263 1.5 5.70196C1.5 3.38128 3.38128 1.5 5.70195 1.5L8.04607 1.5C11.6614 1.5 14.5921 4.43078 14.5921 8.04607L14.5921 29.1922C14.5921 31.019 16.0731 32.5 17.8999 32.5C19.7268 32.5 21.2078 31.019 21.2078 29.1922L21.2078 16.8104"
          />
        </defs>

        {/* Animated reveal path */}
        <path
          ref={revealPathRef}
          d="M30.5 9.90391L5.70195 9.90391C3.38128 9.90391 1.5 8.02263 1.5 5.70196C1.5 3.38128 3.38128 1.5 5.70195 1.5L8.04607 1.5C11.6614 1.5 14.5921 4.43078 14.5921 8.04607L14.5921 29.1922C14.5921 31.019 16.0731 32.5 17.8999 32.5C19.7268 32.5 21.2078 31.019 21.2078 29.1922L21.2078 16.8104"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Main Ball with motion and scale animation - solid white fill */}
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
