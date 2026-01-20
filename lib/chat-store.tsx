"use client";

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { getChats, sendMessage, createNewChatRequest, type Chat, type CompleteEvent } from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

export type PendingChatStatus = 'creating' | 'processing' | 'complete' | 'error';

export interface PendingChat {
    tempId: string;           // "pending-{timestamp}"
    realChatId?: string;      // Set when API returns chat_id
    query: string;
    status: PendingChatStatus;
    createdAt: number;
    errorMessage?: string;
}

export interface DisplayChat {
    id: string;
    name: string;
    isLoading: boolean;
    isPending: boolean;       // True if this is from pending chats
    createdAt: string;
    status?: PendingChatStatus;
    errorMessage?: string;
}

interface ChatStoreState {
    chats: Chat[];
    pendingChats: Map<string, PendingChat>;
    isRefreshing: boolean;
    lastRefresh: number;
}

// ============================================================================
// Actions
// ============================================================================

type ChatStoreAction =
    | { type: 'SET_CHATS'; chats: Chat[] }
    | { type: 'SET_REFRESHING'; isRefreshing: boolean }
    | { type: 'ADD_PENDING'; tempId: string; query: string }
    | { type: 'UPDATE_PENDING_STATUS'; tempId: string; status: PendingChatStatus; realChatId?: string; errorMessage?: string }
    | { type: 'REMOVE_PENDING'; tempId: string }
    | { type: 'COMPLETE_PENDING'; tempId: string; chat: Chat };

function chatStoreReducer(state: ChatStoreState, action: ChatStoreAction): ChatStoreState {
    switch (action.type) {
        case 'SET_CHATS':
            return { ...state, chats: action.chats, lastRefresh: Date.now() };

        case 'SET_REFRESHING':
            return { ...state, isRefreshing: action.isRefreshing };

        case 'ADD_PENDING': {
            const newPending = new Map(state.pendingChats);
            newPending.set(action.tempId, {
                tempId: action.tempId,
                query: action.query,
                status: 'creating',
                createdAt: Date.now(),
            });
            return { ...state, pendingChats: newPending };
        }

        case 'UPDATE_PENDING_STATUS': {
            const pending = state.pendingChats.get(action.tempId);
            if (!pending) return state;

            const newPending = new Map(state.pendingChats);
            newPending.set(action.tempId, {
                ...pending,
                status: action.status,
                realChatId: action.realChatId ?? pending.realChatId,
                errorMessage: action.errorMessage,
            });
            return { ...state, pendingChats: newPending };
        }

        case 'REMOVE_PENDING': {
            const newPending = new Map(state.pendingChats);
            newPending.delete(action.tempId);
            return { ...state, pendingChats: newPending };
        }

        case 'COMPLETE_PENDING': {
            // Remove from pending and add to real chats
            const newPending = new Map(state.pendingChats);
            newPending.delete(action.tempId);

            // Check if chat already exists (avoid duplicate)
            const exists = state.chats.some(c => c.chat_id === action.chat.chat_id);
            const newChats = exists ? state.chats : [...state.chats, action.chat];

            return { ...state, pendingChats: newPending, chats: newChats };
        }

        default:
            return state;
    }
}

// ============================================================================
// Context
// ============================================================================

interface ChatStoreContextValue {
    state: ChatStoreState;

    // Actions
    refreshChats: () => Promise<void>;
    startChatCreation: (query: string) => string; // Returns tempId
    getMergedChats: () => DisplayChat[];
    removePending: (tempId: string) => void;

    // Background polling management
    startBackgroundPolling: (
        tempId: string,
        query: string,
        onComplete: (event: CompleteEvent, wasWatching: boolean) => void,
        onError: (error: string) => void,
        isWatchingRef: React.MutableRefObject<boolean>
    ) => void;
}

const ChatStoreContext = createContext<ChatStoreContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function ChatStoreProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(chatStoreReducer, {
        chats: [],
        pendingChats: new Map(),
        isRefreshing: false,
        lastRefresh: 0,
    });

    // Ref to track active polling operations
    const activePollingRef = useRef<Map<string, AbortController>>(new Map());

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            activePollingRef.current.forEach(controller => controller.abort());
        };
    }, []);

    const refreshChats = useCallback(async () => {
        dispatch({ type: 'SET_REFRESHING', isRefreshing: true });
        try {
            const response = await getChats();
            dispatch({ type: 'SET_CHATS', chats: response.chats });
        } catch (error) {
            console.error('Failed to refresh chats:', error);
        } finally {
            dispatch({ type: 'SET_REFRESHING', isRefreshing: false });
        }
    }, []);

    const startChatCreation = useCallback((query: string): string => {
        const tempId = `pending-${Date.now()}`;
        dispatch({ type: 'ADD_PENDING', tempId, query });
        return tempId;
    }, []);

    const removePending = useCallback((tempId: string) => {
        dispatch({ type: 'REMOVE_PENDING', tempId });
        // Also abort any active polling
        const controller = activePollingRef.current.get(tempId);
        if (controller) {
            controller.abort();
            activePollingRef.current.delete(tempId);
        }
    }, []);

    const startBackgroundPolling = useCallback((
        tempId: string,
        query: string,
        onComplete: (event: CompleteEvent, wasWatching: boolean) => void,
        onError: (error: string) => void,
        isWatchingRef: React.MutableRefObject<boolean>
    ) => {
        const abortController = new AbortController();
        activePollingRef.current.set(tempId, abortController);

        const request = createNewChatRequest(query);

        sendMessage(
            request,
            // onUpdate - update status to processing
            () => {
                dispatch({ type: 'UPDATE_PENDING_STATUS', tempId, status: 'processing' });
            },
            // onComplete
            (event) => {
                activePollingRef.current.delete(tempId);

                // Mark as complete with the real chat ID (shows green checkmark)
                dispatch({
                    type: 'UPDATE_PENDING_STATUS',
                    tempId,
                    status: 'complete',
                    realChatId: event.chat_id,
                });

                // Create the chat object for the store
                const chat: Chat = {
                    chat_id: event.chat_id,
                    chat_name: event.label || query.slice(0, 50),
                    created_at: new Date().toISOString(),
                };

                // Delay before removing pending and adding real chat
                // This allows the user to see the completion state briefly
                setTimeout(() => {
                    dispatch({ type: 'COMPLETE_PENDING', tempId, chat });
                }, 1500);

                // Call the callback with whether user was watching
                const wasWatching = isWatchingRef.current;
                onComplete(event, wasWatching);
            },
            // onError
            (error) => {
                activePollingRef.current.delete(tempId);
                dispatch({
                    type: 'UPDATE_PENDING_STATUS',
                    tempId,
                    status: 'error',
                    errorMessage: error.error,
                });
                onError(error.error);
            },
            { signal: abortController.signal }
        ).catch((err) => {
            // Handle abort or other exceptions
            if (err.name !== 'AbortError') {
                console.error('Background polling error:', err);
                dispatch({
                    type: 'UPDATE_PENDING_STATUS',
                    tempId,
                    status: 'error',
                    errorMessage: err.message || 'Unknown error',
                });
            }
        });
    }, []);

    const getMergedChats = useCallback((): DisplayChat[] => {
        const result: DisplayChat[] = [];
        const realChatIds = new Set(state.chats.map(c => c.chat_id));

        // Add pending chats that don't have a matching real chat yet
        for (const [, pending] of state.pendingChats) {
            // Skip if this pending chat's realChatId already exists in real chats
            if (pending.realChatId && realChatIds.has(pending.realChatId)) {
                continue;
            }

            result.push({
                id: pending.tempId,
                name: pending.query.slice(0, 50) + (pending.query.length > 50 ? '...' : ''),
                isLoading: pending.status === 'creating' || pending.status === 'processing',
                isPending: true,
                createdAt: new Date(pending.createdAt).toISOString(),
                status: pending.status,
                errorMessage: pending.errorMessage,
            });
        }

        // Add real chats
        for (const chat of state.chats) {
            result.push({
                id: chat.chat_id,
                name: chat.chat_name,
                isLoading: false,
                isPending: false,
                createdAt: chat.created_at,
            });
        }

        // Sort by createdAt descending (newest first)
        // Handle timestamps that may not have Z suffix (UTC)
        const parseTimestamp = (ts: string): number => {
            const normalized = ts.endsWith('Z') ? ts : ts + 'Z';
            return new Date(normalized).getTime();
        };

        result.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));

        return result;
    }, [state.chats, state.pendingChats]);

    const value: ChatStoreContextValue = {
        state,
        refreshChats,
        startChatCreation,
        getMergedChats,
        removePending,
        startBackgroundPolling,
    };

    return (
        <ChatStoreContext.Provider value={value}>
            {children}
        </ChatStoreContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useChatStore(): ChatStoreContextValue {
    const context = useContext(ChatStoreContext);
    if (!context) {
        throw new Error('useChatStore must be used within a ChatStoreProvider');
    }
    return context;
}
