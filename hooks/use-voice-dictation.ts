"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceDictationOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  continuous?: boolean;
  language?: string;
}

interface UseVoiceDictationReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
  audioLevel: number;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function useVoiceDictation({
  onTranscript,
  continuous = true,
  language = 'en-US',
}: UseVoiceDictationOptions = {}): UseVoiceDictationReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(false);
  
  // Track accumulated final transcripts
  const accumulatedTranscriptRef = useRef('');

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI = 
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  // Analyze audio levels - uses ref to control loop instead of state
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !isAnalyzingRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume level (0-1)
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    // More sensitive normalization and add minimum idle movement
    const normalizedLevel = Math.min(average / 80, 1);
    
    // Add subtle idle animation when not speaking (random micro-movements)
    const idleNoise = 0.05 + Math.random() * 0.08;
    const finalLevel = normalizedLevel > 0.05 ? normalizedLevel : idleNoise;
    
    setAudioLevel(finalLevel);

    // Continue the loop using ref
    if (isAnalyzingRef.current) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, []);

  // Setup audio analyzer for visual feedback
  const setupAudioAnalyzer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.5;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Start the animation loop
      isAnalyzingRef.current = true;
      analyzeAudio();
    } catch (err) {
      console.error('Failed to setup audio analyzer:', err);
    }
  }, [analyzeAudio]);

  // Cleanup audio analyzer
  const cleanupAudioAnalyzer = useCallback(() => {
    // Stop the animation loop first
    isAnalyzingRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    const SpeechRecognitionAPI = 
      window.SpeechRecognition || window.webkitSpeechRecognition;

    recognitionRef.current = new SpeechRecognitionAPI();
    recognitionRef.current.continuous = continuous;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = language;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setError(null);
      // Reset accumulated transcript when starting fresh
      accumulatedTranscriptRef.current = '';
      setupAudioAnalyzer();
    };

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let newFinalTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // If we have new final transcript, add it to accumulated
      if (newFinalTranscript) {
        const trimmedNew = newFinalTranscript.trim();
        if (trimmedNew) {
          if (accumulatedTranscriptRef.current) {
            accumulatedTranscriptRef.current += ' ' + trimmedNew;
          } else {
            accumulatedTranscriptRef.current = trimmedNew;
          }
        }
      }

      // Build the full transcript: accumulated finals + current interim
      const fullTranscript = interimTranscript
        ? (accumulatedTranscriptRef.current ? accumulatedTranscriptRef.current + ' ' + interimTranscript : interimTranscript)
        : accumulatedTranscriptRef.current;

      setTranscript(fullTranscript);
      onTranscript?.(fullTranscript, !!newFinalTranscript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setError(`Error: ${event.error}`);
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      cleanupAudioAnalyzer();
    };

    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setError('Failed to start speech recognition');
    }
  }, [isSupported, continuous, language, setupAudioAnalyzer, cleanupAudioAnalyzer, onTranscript]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    cleanupAudioAnalyzer();
  }, [cleanupAudioAnalyzer]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isSupported,
    transcript,
    error,
    audioLevel,
    startListening,
    stopListening,
    toggleListening,
  };
}
