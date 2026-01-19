"use client";

import React from 'react';
import { LoadingTips } from './loading-tips';

interface GraphLoadingProps {
  query?: string;
  isFinished?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onTransitionComplete?: () => void;
}

export function GraphLoading({ query, isFinished, isError, errorMessage, onTransitionComplete }: GraphLoadingProps) {
  return (
    <div className="h-full w-full">
      <LoadingTips
        query={query}
        isFinished={isFinished}
        isError={isError}
        errorMessage={errorMessage}
        onTransitionComplete={onTransitionComplete}
      />
    </div>
  );
}
