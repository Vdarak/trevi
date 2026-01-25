"use client";

/**
 * Cross-browser clipboard utility with fallback for Safari iOS.
 * Safari iOS doesn't support navigator.clipboard in all contexts.
 * 
 * Supports both string and async string generator (Promise) functions.
 * Using a generator function is required for Safari iOS when the content
 * needs to be fetched asynchronously (limit ~1s).
 */
export async function copyToClipboard(textOrPromise: string | (() => Promise<string>)): Promise<boolean> {
    // Helper to resolve text
    const getText = async () => {
        return typeof textOrPromise === 'function' ? await textOrPromise() : textOrPromise;
    };

    // Case 1: Async generator provided (Promise-based ClipboardItem)
    if (typeof textOrPromise === 'function') {
        // Modern approach: Promise-based ClipboardItem
        // This keeps the "user gesture" valid while content loads
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
            try {
                // Safari/Chrome support passing a promise to ClipboardItem
                // We construct the ClipboardItem immediately with a promise
                const item = new ClipboardItem({
                    "text/plain": textOrPromise().then(text => new Blob([text], { type: "text/plain" }))
                });
                await navigator.clipboard.write([item]);
                return true;
            } catch (err) {
                console.warn("Async ClipboardItem failed, falling back to sync wait", err);
                // Fallthrough to sync fallback
            }
        }
    }

    // Case 2: String provided OR async fallback failed
    // Ensure we have the text (might lose context here if async took too long)
    let text: string;
    try {
        text = await getText();
    } catch (err) {
        console.error("Failed to generate text for clipboard", err);
        return false;
    }

    // Try modern clipboard API first (writeText)
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('Clipboard API failed, trying fallback:', err);
        }
    }

    // Fallback: use legacy execCommand with a textarea
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // Prevent scrolling to bottom of page on iOS
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.style.opacity = '0';

        document.body.appendChild(textArea);

        // iOS specific: need to focus and select
        textArea.focus();
        textArea.select();

        // For iOS, we need to use setSelectionRange
        textArea.setSelectionRange(0, text.length);

        const success = document.execCommand('copy');
        document.body.removeChild(textArea);

        return success;
    } catch (err) {
        console.error('Fallback clipboard copy failed:', err);
        return false;
    }
}
