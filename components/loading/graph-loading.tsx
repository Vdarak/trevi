"use client";

import React from 'react';
import { LoadingTips } from './loading-tips';

interface GraphLoadingProps {
  query?: string;
  isFinished?: boolean;
  onTransitionComplete?: () => void;
}

export function GraphLoading({ query, isFinished, onTransitionComplete }: GraphLoadingProps) {
  return (
    <div className="h-full w-full">
      <LoadingTips
        query={query}
        isFinished={isFinished}
        onTransitionComplete={onTransitionComplete}
      />
    </div>
  );
}
