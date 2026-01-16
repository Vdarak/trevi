"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Send, Loader2, Atom, ScrollText, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useVoiceDictation } from '@/hooks/use-voice-dictation';

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  statusMessage?: string;
}

// Cycling placeholder questions for the input
const PLACEHOLDER_QUESTIONS = [
  "Why do black holes emit radiation?",
  "What caused the fall of the Roman Empire?",
  "How does CRISPR gene editing work?",
  "What is the origin of language?",
  "How do neural networks learn?",
  "Why do we dream?",
  "What triggers mass extinctions?",
  "How does quantum entanglement work?",
];

// Suggestion cards with icons and trending questions
const SUGGESTION_CARDS = [
  {
    category: "Science",
    icon: Atom,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "hover:border-purple-200",
    question: "How does mRNA vaccine technology work and what makes it different from traditional vaccines?",
  },
  {
    category: "History",
    icon: ScrollText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "hover:border-amber-200",
    question: "What were the key factors that led to the Renaissance and how did it transform European society?",
  },
  {
    category: "Tech",
    icon: Cpu,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "hover:border-blue-200",
    question: "How do large language models like GPT actually understand and generate human language?",
  },
];

// Compact audio level visualizer bars for inline mic button
function InlineAudioBars({ level }: { level: number }) {
  const barCount = 4;
  const barMultipliers = [0.7, 1.0, 0.85, 0.6];

  return (
    <div className="flex items-center justify-center gap-0.5 h-4">
      {Array.from({ length: barCount }).map((_, i) => {
        const barLevel = level * barMultipliers[i];
        const minHeight = 3;
        const maxHeight = 14;
        const dynamicHeight = minHeight + (barLevel * (maxHeight - minHeight));

        return (
          <div
            key={i}
            className="w-0.5 rounded-full bg-red-500 transition-all duration-75 ease-out"
            style={{ height: `${dynamicHeight}px` }}
          />
        );
      })}
    </div>
  );
}

// Typing animation hook for placeholder
function useTypingPlaceholder(questions: string[], typingSpeed = 50, pauseDuration = 2000) {
  const [displayText, setDisplayText] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const currentQuestion = questions[questionIndex];

    if (isTyping) {
      if (charIndex < currentQuestion.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentQuestion.slice(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        }, typingSpeed);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, pauseDuration);
        return () => clearTimeout(timeout);
      }
    } else {
      if (charIndex > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(currentQuestion.slice(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        }, typingSpeed / 2);
        return () => clearTimeout(timeout);
      } else {
        setQuestionIndex((prev) => (prev + 1) % questions.length);
        setIsTyping(true);
      }
    }
  }, [charIndex, isTyping, questionIndex, questions, typingSpeed, pauseDuration]);

  return displayText;
}

export function ChatInterface({ onSendMessage, isLoading, statusMessage }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const preVoiceTextRef = useRef("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get animated placeholder text
  const animatedPlaceholder = useTypingPlaceholder(PLACEHOLDER_QUESTIONS);

  const {
    isListening,
    isSupported,
    audioLevel,
    error: voiceError,
    toggleListening,
    stopListening,
  } = useVoiceDictation({
    onTranscript: (transcript) => {
      const preText = preVoiceTextRef.current;
      if (preText) {
        setMessage(preText + ' ' + transcript);
      } else {
        setMessage(transcript);
      }
    },
    continuous: true,
  });

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (message.trim() && !isLoading) {
      if (isListening) {
        stopListening();
      }
      preVoiceTextRef.current = "";
      onSendMessage(message.trim());
      setMessage("");
    }
  }, [message, isLoading, isListening, stopListening, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

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
      preVoiceTextRef.current = message.trim();
    } else {
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

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  return (
    <div className="flex flex-col items-center justify-start md:justify-center min-h-full w-full max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-4 sm:pt-6 sm:pb-6 overflow-hidden sm:overflow-y-auto">
      {/* Hero Text - Responsive sizing */}
      <div className="text-center mb-4 sm:mb-6 md:mb-8 mt-4 lg:mb-10 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight mb-2 sm:mb-3 md:mb-4 text-slate-900">
          What are you curious about?
        </h1>
        <p className="text-slate-500 text-sm sm:text-base md:text-lg lg:text-xl px-2">
          Research and explore <span className="font-bold text-slate-700">your</span> curiosity to the deepest levels
        </p>
      </div>

      {/* Input Box - Responsive with black focus ring */}
      <form onSubmit={handleSubmit} className="w-full relative mb-4 sm:mb-6 md:mb-8 flex-shrink-0">
        <div className={`relative bg-white border-2 rounded-2xl shadow-lg transition-all ${isListening
          ? 'border-red-400 ring-4 ring-red-100'
          : 'border-slate-200 hover:border-slate-300 focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-200'
          }`}>
          {/* Animated placeholder in top left when empty and not listening */}
          {!message && !isListening && (
            <div className="absolute top-3 sm:top-4 left-4 sm:left-5 pointer-events-none">
              <span className="text-sm sm:text-base md:text-lg text-slate-400">{animatedPlaceholder}</span>
              <span className="inline-block w-0.5 h-3.5 sm:h-4 md:h-5 bg-slate-400 ml-0.5 animate-pulse" />
            </div>
          )}

          {/* Listening state placeholder inside input */}
          {isListening && !message && (
            <div className="absolute top-3 sm:top-4 left-4 sm:left-5 pointer-events-none flex items-center gap-2">
              <span className="text-base sm:text-lg text-red-400">Listening...</span>
            </div>
          )}

          <textarea
            ref={inputRef}
            placeholder=""
            className="w-full min-h-[100px] md:min-h-[100px] lg:min-h-[120px] max-h-[150px] sm:max-h-[200px] px-4 sm:px-5 py-3.5 sm:py-4 md:py-5 pr-24 sm:pr-36 md:pr-40 text-base md:text-lg text-slate-900 bg-transparent resize-none focus:outline-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoFocus
            rows={1}
          />

          {/* Action buttons - bottom right */}
          <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex items-center gap-1.5 sm:gap-2">
            {/* Mic button - shows "Speak" with mic OR "X Listening bars" */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={isLoading}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-medium transition-all ${isListening
                ? 'bg-red-100 text-red-600 hover:bg-red-200 px-2.5 sm:px-3'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700 w-9 sm:w-10'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isListening ? 'Stop listening' : 'Start voice dictation'}
            >
              {isListening ? (
                <>
                  <span className="text-red-500 font-bold">✕</span>
                  <span>Listening</span>
                  <InlineAudioBars level={audioLevel} />
                </>
              ) : (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            {/* Send button */}
            <Button
              type="submit"
              size="icon"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors"
              disabled={isLoading || !message.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Voice Error Message */}
      {voiceError && (
        <div className="mb-4 text-sm text-red-500 text-center">
          {voiceError}
        </div>
      )}

      {/* Status Message */}
      {isLoading && statusMessage && (
        <div className="mb-6 sm:mb-8 flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* Suggestion Cards with Icons - Responsive grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 w-full">
          {SUGGESTION_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.category}
                className={`p-4 sm:p-5 cursor-pointer transition-all duration-200 border-2 border-slate-100 shadow-none hover:shadow-md ${card.borderColor} group`}
                onClick={() => handleSuggestionClick(card.question)}
              >
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className={`p-2 sm:p-2.5 rounded-xl ${card.bgColor} transition-transform group-hover:scale-110 flex-shrink-0`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${card.color}`}>
                      {card.category}
                    </span>
                    <p className="text-xs sm:text-sm font-medium text-slate-700 mt-0.5 sm:mt-1 leading-relaxed line-clamp-3">
                      {card.question}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
