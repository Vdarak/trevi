"use client";

/**
 * Cross-browser clipboard utility with fallback for Safari iOS.
 * Safari iOS doesn't support navigator.clipboard in all contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    // Try modern clipboard API first
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fall through to legacy method
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
