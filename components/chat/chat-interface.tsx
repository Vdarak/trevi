"use client";

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useVoiceDictation } from '@/hooks/use-voice-dictation';

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  statusMessage?: string;
}

// Audio level visualizer bars component
function AudioLevelBars({ level, isActive }: { level: number; isActive: boolean }) {
  const barCount = 5;

  // Use slightly different multipliers for each bar to create variation
  const barMultipliers = [0.6, 0.9, 1.0, 0.85, 0.7];

  return (
    <div className="flex items-center justify-center gap-0.5 h-5">
      {Array.from({ length: barCount }).map((_, i) => {
        // Each bar has different sensitivity for natural look
        const barLevel = level * barMultipliers[i];
        // Minimum height + dynamic height based on audio level
        const minHeight = 4;
        const maxHeight = 16;
        const dynamicHeight = minHeight + (barLevel * (maxHeight - minHeight));

        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-100 ease-out ${isActive ? 'bg-destructive' : 'bg-muted-foreground'
              }`}
            style={{
              height: `${dynamicHeight}px`,
            }}
          />
        );
      })}
    </div>
  );
}

export function ChatInterface({ onSendMessage, isLoading, statusMessage }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  // Track what user typed before starting voice
  const preVoiceTextRef = React.useRef("");

  const {
    isListening,
    isSupported,
    audioLevel,
    error: voiceError,
    toggleListening,
    stopListening,
  } = useVoiceDictation({
    onTranscript: (transcript) => {
      // Combine pre-voice text with voice transcript
      const preText = preVoiceTextRef.current;
      if (preText) {
        setMessage(preText + ' ' + transcript);
      } else {
        setMessage(transcript);
      }
    },
    continuous: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      // Stop listening if active when submitting
      if (isListening) {
        stopListening();
      }
      preVoiceTextRef.current = "";
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      onSendMessage(suggestion);
    }
  };

  const handleMicClick = () => {
    if (!isSupported) {
      alert('Voice dictation is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (!isListening) {
      // Save current text before starting voice dictation
      preVoiceTextRef.current = message.trim();
    } else {
      // Clear the ref when stopping
      preVoiceTextRef.current = "";
    }

    toggleListening();
  };

  // Stop listening when loading starts
  useEffect(() => {
    if (isLoading && isListening) {
      stopListening();
      preVoiceTextRef.current = "";
    }
  }, [isLoading, isListening, stopListening]);

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto px-4 w-full">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-foreground">Explore Anything</h1>
        <p className="text-muted-foreground text-lg">
          Research and explore any topic.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full relative mb-8">
        {/* Voice listening indicator above input */}
        {isListening && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/75 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            </span>
            <span className="text-xs font-medium text-destructive">Listening...</span>
            <AudioLevelBars level={audioLevel} isActive={isListening} />
          </div>
        )}

        <Input
          placeholder={isListening ? "Speak now..." : "Start typing..."}
          className={`h-14 pl-6 pr-24 rounded-full shadow-sm text-lg transition-all ${isListening
            ? 'border-destructive/30 ring-2 ring-destructive/10'
            : ''
            }`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={`rounded-full transition-all ${isListening
              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
              : ''
              }`}
            disabled={isLoading}
            onClick={handleMicClick}
            title={isListening ? 'Stop dictation' : 'Start voice dictation'}
          >
            {isListening ? (
              <div className="relative">
                <MicOff className="w-5 h-5" />
                {/* Pulsing ring when active */}
                <span className="absolute inset-0 rounded-full animate-ping bg-destructive/20 opacity-20" />
              </div>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </Button>
          <Button
            type="submit"
            size="icon"
            className="rounded-full"
            disabled={isLoading || !message.trim()}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Voice Error Message */}
      {voiceError && (
        <div className="mb-4 text-sm text-destructive">
          {voiceError}
        </div>
      )}

      {/* Status Message */}
      {isLoading && statusMessage && (
        <div className="mb-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* Suggestions */}
      {!isLoading && !isListening && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <Card
            className="p-4 hover:bg-muted/50 cursor-pointer transition-colors shadow-none"
            onClick={() => handleSuggestionClick("What will be the weather tomorrow")}
          >
            <p className="text-sm font-medium text-foreground">What will be the weather tomorrow</p>
          </Card>
          <Card
            className="p-4 hover:bg-muted/50 cursor-pointer transition-colors shadow-none"
            onClick={() => handleSuggestionClick("How does rocket ships work in general")}
          >
            <p className="text-sm font-medium text-foreground">How does rocket ships work in general</p>
          </Card>
          <Card
            className="p-4 hover:bg-muted/50 cursor-pointer transition-colors shadow-none"
            onClick={() => handleSuggestionClick("Corresponding grammatical structure")}
          >
            <p className="text-sm font-medium text-foreground">Corresponding grammatical structure</p>
          </Card>
        </div>
      )}
    </div>
  );
}
