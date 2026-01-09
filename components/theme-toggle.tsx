"use client";

import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme, effectiveTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    if (theme === "system") {
      return <Monitor className="w-5 h-5" />;
    }
    return effectiveTheme === "dark" ? (
      <Moon className="w-5 h-5" />
    ) : (
      <Sun className="w-5 h-5" />
    );
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg transition-colors bg-card hover:bg-muted border border-border text-foreground"
      aria-label="Toggle theme"
      title={`Current: ${theme === "system" ? `System (${effectiveTheme})` : theme}`}
    >
      {getIcon()}
    </button>
  );
}
