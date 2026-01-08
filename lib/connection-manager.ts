/**
 * Connection Manager
 * 
 * Tracks multiple active SSE connections for node exploration.
 * Provides abort control, error tracking, and state change notifications.
 */

export interface ActiveConnection {
    nodeId: string;
    nodeLabel: string;
    abortController: AbortController;
    startedAt: number;
}

export interface ConnectionError {
    nodeId: string;
    nodeLabel: string;
    error: string;
    timestamp: number;
}

/**
 * Manages multiple concurrent API connections with abort capability.
 * Tracks active connections and recent errors for UI display.
 */
export class ConnectionManager {
    private connections = new Map<string, ActiveConnection>();
    private errors: ConnectionError[] = [];
    private listeners = new Set<() => void>();

    // How long to keep errors visible (in ms)
    private static ERROR_RETENTION_MS = 5000;

    /**
     * Start a new connection for a node.
     * If a connection already exists for this node, it will be aborted first.
     */
    start(nodeId: string, nodeLabel: string): AbortController {
        // Abort existing connection for this node if any
        const existing = this.connections.get(nodeId);
        if (existing) {
            existing.abortController.abort();
        }

        const abortController = new AbortController();
        this.connections.set(nodeId, {
            nodeId,
            nodeLabel,
            abortController,
            startedAt: Date.now(),
        });

        this.notifyListeners();
        return abortController;
    }

    /**
     * Mark a connection as successfully completed.
     */
    complete(nodeId: string): void {
        this.connections.delete(nodeId);
        this.notifyListeners();
    }

    /**
     * Record an error for a connection.
     * Connection is removed and error is stored for display.
     */
    error(nodeId: string, errorMessage: string): void {
        const connection = this.connections.get(nodeId);
        const nodeLabel = connection?.nodeLabel || nodeId;

        this.connections.delete(nodeId);
        this.errors.push({
            nodeId,
            nodeLabel,
            error: errorMessage,
            timestamp: Date.now(),
        });

        this.notifyListeners();

        // Auto-clear old errors after retention period
        setTimeout(() => {
            this.clearOldErrors();
        }, ConnectionManager.ERROR_RETENTION_MS);
    }

    /**
     * Get all currently active connections.
     */
    getActive(): ActiveConnection[] {
        return Array.from(this.connections.values());
    }

    /**
     * Get active connection node IDs.
     */
    getActiveNodeIds(): Set<string> {
        return new Set(this.connections.keys());
    }

    /**
     * Check if a specific node is currently loading.
     */
    isLoading(nodeId: string): boolean {
        return this.connections.has(nodeId);
    }

    /**
     * Get count of active connections.
     */
    getActiveCount(): number {
        return this.connections.size;
    }

    /**
     * Get recent errors (within retention period).
     */
    getRecentErrors(): ConnectionError[] {
        const cutoff = Date.now() - ConnectionManager.ERROR_RETENTION_MS;
        return this.errors.filter(e => e.timestamp > cutoff);
    }

    /**
     * Dismiss a specific error.
     */
    dismissError(nodeId: string): void {
        this.errors = this.errors.filter(e => e.nodeId !== nodeId);
        this.notifyListeners();
    }

    /**
     * Clear all errors.
     */
    clearErrors(): void {
        this.errors = [];
        this.notifyListeners();
    }

    /**
     * Cancel all active connections (e.g., when navigating away).
     */
    cancelAll(): void {
        this.connections.forEach(conn => {
            conn.abortController.abort();
        });
        this.connections.clear();
        // Don't add errors for intentional cancellations
        this.notifyListeners();
    }

    /**
     * Subscribe to state changes.
     * Returns unsubscribe function.
     */
    subscribe(callback: () => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach(cb => cb());
    }

    private clearOldErrors(): void {
        const cutoff = Date.now() - ConnectionManager.ERROR_RETENTION_MS;
        const hadErrors = this.errors.length > 0;
        this.errors = this.errors.filter(e => e.timestamp > cutoff);

        if (hadErrors && this.errors.length === 0) {
            this.notifyListeners();
        }
    }
}

// Singleton instance for the app
let connectionManagerInstance: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
    if (!connectionManagerInstance) {
        connectionManagerInstance = new ConnectionManager();
    }
    return connectionManagerInstance;
}
