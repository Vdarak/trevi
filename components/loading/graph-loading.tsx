"use client";

import React from 'react';
import { LoadingTips } from './loading-tips';

interface GraphLoadingProps {
  query?: string;
}

export function GraphLoading({ query }: GraphLoadingProps) {
  return (
    <div className="h-full w-full">
      <LoadingTips query={query} />
    </div>
  );
}
